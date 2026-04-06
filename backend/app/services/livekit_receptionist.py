import json
import logging
from dataclasses import dataclass
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from openai import APIError, AsyncOpenAI, RateLimitError
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.booking import Booking, BookingSource, BookingStatus
from app.models.service import Service
from app.models.tenant import Tenant
from app.models.working_hours import WorkingHours
from app.services.slots import get_available_slots_for_service
from app.services.booking_validation import validate_slot_calendar_date, validate_booking_start_time

logger = logging.getLogger(__name__)


INTENTS = {
    "BOOK_APPOINTMENT",
    "GENERAL_QUERY",
    "GREETING",
    "CANCEL_APPOINTMENT",
    "RESCHEDULE_APPOINTMENT",
    "UNKNOWN",
}

# Word-boundary / phrase patterns only — bare substrings like "doctor" in "doctor's hours"
# must not trigger the deterministic booking flow.
_BOOKING_INTENT_RE = re.compile(
    r"\b(book|booking|booked|appointment|appointments|schedule|scheduled|reschedule|rescheduling)\b"
    r"|(?:see|visit)\s+(?:a\s+)?(?:the\s+)?doctor"
    r"|(?:at|to)\s+(?:the\s+)?clinic"
    r"|\bmake\s+(?:an?\s+)?appointment\b",
    re.IGNORECASE,
)


@dataclass
class TenantContext:
    tenant_id: int
    tenant_name: str
    tenant_slug: str | None
    default_service_id: int | None


def _agent_prompt(ctx: TenantContext) -> str:
    today_utc = datetime.now(timezone.utc).date().isoformat()
    return (
        f"You are the phone receptionist for {ctx.tenant_name}.\n"
        "Keep replies short and natural for a phone call (1-2 sentences).\n\n"
        f"Today's date (UTC): {today_utc}\n\n"
        "Booking flow (when the caller wants an appointment):\n"
        "1) If date is missing, ask only one concise question to get the date.\n"
        "   - Understand words like 'today' and 'tomorrow' and convert them to YYYY-MM-DD using UTC.\n"
        "2) After you have the date, ask which service they want (this is important).\n"
        "3) Once service is chosen, call get_available_slots(date=YYYY-MM-DD, service_name=chosen_service).\n"
        "4) Tell the caller available times (short list, do not read every slot).\n"
        "5) When the caller picks a time, you MUST match it against the slots returned from get_available_slots.\n"
        "6) Then call create_booking(start_time=slot.start_time, end_time=slot.end_time, service_name=chosen_service).\n"
        "7) If create_booking returns an error with slot_taken=true, call get_available_slots again for the SAME date and offer updated times.\n"
        "8) Do NOT end the conversation when a booking attempt fails.\n\n"
        "General queries (when the caller asks about clinic info):\n"
        "- Use get_services and get_business_hours if needed.\n"
        "- Never invent services, hours, or prices.\n"
        "- If they started booking but ask something else mid-flow (hours, address, insurance), answer that first in one short reply, then remind them what you still need for the appointment (date, service, or time).\n\n"
        "Critical:\n"
        "- Never call create_booking unless start_time/end_time came directly from a get_available_slots result.\n"
        "- Never fabricate availability.\n"
    )


def _intent_prompt(ctx: TenantContext, user_text: str) -> str:
    return (
        "Classify this caller intent.\n"
        f"Tenant: {ctx.tenant_name}.\n"
        f"User utterance: {user_text}\n\n"
        "Return strict JSON with keys: intent, confidence, reason, tool_hint.\n"
        "intent must be one of: BOOK_APPOINTMENT, GENERAL_QUERY, GREETING, "
        "CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT, UNKNOWN.\n"
        "tool_hint must be one of: none, get_services, get_business_hours, "
        "get_available_slots, create_booking."
    )


def _tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_services",
                "description": "List clinic services for this tenant.",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_business_hours",
                "description": "Get clinic working hours. Optional weekday index 0-6.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day_of_week": {"type": "integer", "description": "0=Monday ... 6=Sunday"},
                    },
                    "required": [],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_available_slots",
                "description": "Find available slots by service and date (YYYY-MM-DD).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "Date in YYYY-MM-DD"},
                        "service_name": {"type": "string", "description": "Optional service name from clinic services"},
                    },
                    "required": ["date"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_booking",
                "description": "Create booking using exact slot ISO timestamps.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "start_time": {"type": "string"},
                        "end_time": {"type": "string"},
                        "service_name": {"type": "string"},
                        "patient_name": {"type": "string"},
                    },
                    "required": ["start_time", "end_time"],
                },
            },
        },
    ]


async def _resolve_service_id(db: AsyncSession, tenant_id: int, service_name: str | None, fallback_id: int | None) -> int | None:
    if service_name:
        result = await db.execute(
            select(Service).where(
                Service.tenant_id == tenant_id,
                func.lower(Service.name) == service_name.strip().lower(),
            )
        )
        service = result.scalar_one_or_none()
        if service:
            return service.id
    if fallback_id:
        return fallback_id
    first = await db.execute(select(Service).where(Service.tenant_id == tenant_id).order_by(Service.id).limit(1))
    svc = first.scalar_one_or_none()
    return svc.id if svc else None


async def _run_tool(
    tool_name: str,
    args: dict[str, Any],
    db: AsyncSession,
    ctx: TenantContext,
    caller_phone: str | None,
    current_user_id: int | None,
) -> str:
    if tool_name == "get_services":
        rows = await db.execute(
            select(Service).where(Service.tenant_id == ctx.tenant_id).order_by(Service.id)
        )
        services = rows.scalars().all()
        return json.dumps(
            {
                "services": [
                    {
                        "name": s.name,
                        "description": s.description,
                        "price": float(s.price),
                        "slot_minutes": s.slot_duration_minutes,
                    }
                    for s in services
                ]
            }
        )

    if tool_name == "get_business_hours":
        day = args.get("day_of_week")
        query = select(WorkingHours).where(WorkingHours.tenant_id == ctx.tenant_id)
        if day is not None:
            query = query.where(WorkingHours.day_of_week == int(day))
        query = query.order_by(WorkingHours.day_of_week)
        rows = await db.execute(query)
        data = rows.scalars().all()
        return json.dumps(
            {
                "hours": [
                    {
                        "day_of_week": x.day_of_week,
                        "open_time": x.open_time.isoformat(),
                        "close_time": x.close_time.isoformat(),
                    }
                    for x in data
                ]
            }
        )

    if tool_name == "get_available_slots":
        date_s = str(args.get("date", "")).strip()
        try:
            d = datetime.strptime(date_s, "%Y-%m-%d").date()
        except ValueError:
            return json.dumps({"error": "Invalid date format. Use YYYY-MM-DD."})
        past_d = validate_slot_calendar_date(d)
        if past_d:
            return json.dumps({"error": past_d})
        service_id = await _resolve_service_id(
            db,
            tenant_id=ctx.tenant_id,
            service_name=args.get("service_name"),
            fallback_id=ctx.default_service_id,
        )
        if not service_id:
            return json.dumps({"error": "No service configured for this clinic."})
        slots = await get_available_slots_for_service(db, service_id, d)
        return json.dumps({"date": date_s, "service_id": service_id, "slots": slots})

    if tool_name == "create_booking":
        service_id = await _resolve_service_id(
            db,
            tenant_id=ctx.tenant_id,
            service_name=args.get("service_name"),
            fallback_id=ctx.default_service_id,
        )
        if not service_id:
            return json.dumps({"error": "No service configured for this clinic."})
        try:
            start_time = datetime.fromisoformat(str(args.get("start_time", "")).replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(str(args.get("end_time", "")).replace("Z", "+00:00"))
        except ValueError:
            return json.dumps({"error": "Invalid start/end time."})
        if start_time >= end_time:
            return json.dumps({"error": "start_time must be before end_time."})
        past_s = validate_booking_start_time(start_time)
        if past_s:
            return json.dumps({"error": past_s})

        limit_row = await db.execute(
            select(Service).where(Service.id == service_id, Service.tenant_id == ctx.tenant_id)
        )
        service = limit_row.scalar_one_or_none()
        if not service:
            return json.dumps({"error": "Service not found."})

        if caller_phone:
            day_start = datetime.combine(start_time.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
            day_end = day_start + timedelta(days=1)
            cnt_row = await db.execute(
                select(func.count()).select_from(Booking).where(
                    Booking.tenant_id == ctx.tenant_id,
                    Booking.service_id == service_id,
                    Booking.guest_phone == caller_phone,
                    Booking.status != BookingStatus.CANCELLED,
                    Booking.start_time >= day_start,
                    Booking.start_time < day_end,
                )
            )
            daily_limit = service.max_bookings_per_user_per_day or 2
            if (cnt_row.scalar() or 0) >= daily_limit:
                return json.dumps({"error": f"Daily booking limit reached ({daily_limit})."})

        overlap = await db.execute(
            select(Booking).where(
                and_(
                    Booking.service_id == service_id,
                    Booking.status != BookingStatus.CANCELLED,
                    Booking.start_time < end_time,
                    Booking.end_time > start_time,
                )
            )
        )
        if overlap.scalar_one_or_none():
            return json.dumps({"error": "Selected slot is already taken.", "slot_taken": True})

        booking = Booking(
            tenant_id=ctx.tenant_id,
            service_id=service_id,
            user_id=current_user_id,
            guest_phone=caller_phone,
            start_time=start_time,
            end_time=end_time,
            status=BookingStatus.CONFIRMED,
            source=BookingSource.VOICE,
        )
        db.add(booking)
        await db.flush()
        return json.dumps(
            {
                "success": True,
                "booking_id": booking.id,
                "start_time": booking.start_time.isoformat(),
                "end_time": booking.end_time.isoformat(),
            }
        )

    return json.dumps({"error": f"Unsupported tool: {tool_name}"})


async def resolve_tenant_context(db: AsyncSession, tenant_key: str) -> TenantContext | None:
    key = (tenant_key or "").strip()
    if not key:
        return None
    tenant: Tenant | None = None
    if key.isdigit():
        row = await db.execute(select(Tenant).where(Tenant.id == int(key), Tenant.is_active == True))
        tenant = row.scalar_one_or_none()
    if not tenant:
        row = await db.execute(
            select(Tenant).where(
                Tenant.is_active == True,
                func.lower(Tenant.slug) == key.lower(),
            )
        )
        tenant = row.scalar_one_or_none()
    if not tenant:
        row = await db.execute(
            select(Tenant).where(
                Tenant.is_active == True,
                func.lower(Tenant.name) == key.lower(),
            )
        )
        tenant = row.scalar_one_or_none()
    if not tenant:
        return None
    return TenantContext(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        default_service_id=tenant.default_service_id,
    )


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _extract_next_weekday_from_text(t: str) -> date | None:
    """Next occurrence of weekday name (Mon–Sun), UTC calendar date."""
    tl = t.strip().lower()
    names = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    for i, name in enumerate(names):
        if re.search(rf"\b{name}\b", tl):
            today = _utc_today()
            delta = (i - today.weekday()) % 7
            return today + timedelta(days=delta)
    return None


_MONTH_NAME_TO_NUM = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _roll_future_if_past(cand: date) -> date:
    """If date is before today (UTC), assume next calendar year for month/day-only parses."""
    today = _utc_today()
    if cand >= today:
        return cand
    try:
        return date(cand.year + 1, cand.month, cand.day)
    except ValueError:
        return cand


def _parse_numeric_slash_dates(t: str) -> date | None:
    """
    MM/DD/YYYY, DD/MM/YYYY, M/D/YY (tries both orders when ambiguous).
    """
    tl = t.strip().lower()
    m = re.search(r"\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b", tl)
    if m:
        a, b, ys = int(m.group(1)), int(m.group(2)), m.group(3)
        y = int(ys) + (2000 if len(ys) == 2 else 0)
        for mo, d in ((a, b), (b, a)):
            if 1 <= mo <= 12 and 1 <= d <= 31:
                try:
                    return date(y, mo, d)
                except ValueError:
                    continue
    return None


def _parse_month_day_without_year(t: str) -> date | None:
    """e.g. 4/15 or 15/4 without year — use current year, roll if already past."""
    tl = t.strip().lower()
    m = re.search(r"\b(\d{1,2})[/.](\d{1,2})\b", tl)
    if not m:
        return None
    # Avoid matching times like 12/30 as date when it's "12:30" — require not followed by am/pm
    if re.search(r"\d{1,2}[/.]\d{1,2}\s*(a\.?m\.?|p\.?m\.?)\b", tl):
        return None
    a, b = int(m.group(1)), int(m.group(2))
    y = _utc_today().year
    for mo, d in ((a, b), (b, a)):
        if 1 <= mo <= 12 and 1 <= d <= 31:
            try:
                cand = date(y, mo, d)
                return _roll_future_if_past(cand)
            except ValueError:
                continue
    return None


def _parse_month_name_dates(t: str) -> date | None:
    """
    April 5, April 5th, 5 April, 5th of April, April 5 2026, etc.
    """
    tl = t.strip().lower()

    m = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{4})\b",
        tl,
    )
    if m:
        month = _MONTH_NAME_TO_NUM.get(m.group(1), 0)
        day = int(m.group(2))
        year = int(m.group(3))
        if month and 1 <= day <= 31:
            try:
                return date(year, month, day)
            except ValueError:
                return None

    m = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?",
        tl,
    )
    if m:
        day = int(m.group(1))
        month = _MONTH_NAME_TO_NUM.get(m.group(2), 0)
        year = int(m.group(3)) if m.group(3) else _utc_today().year
        if month and 1 <= day <= 31:
            try:
                cand = date(year, month, day)
                if not m.group(3):
                    cand = _roll_future_if_past(cand)
                return cand
            except ValueError:
                return None

    m = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:\s+(\d{4}))?",
        tl,
    )
    if m:
        month = _MONTH_NAME_TO_NUM.get(m.group(1), 0)
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else _utc_today().year
        if month and 1 <= day <= 31:
            try:
                cand = date(year, month, day)
                if not m.group(3):
                    cand = _roll_future_if_past(cand)
                return cand
            except ValueError:
                return None

    m = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?",
        tl,
    )
    if m:
        day = int(m.group(1))
        month = _MONTH_NAME_TO_NUM.get(m.group(2), 0)
        year = int(m.group(3)) if m.group(3) else _utc_today().year
        if month and 1 <= day <= 31:
            try:
                cand = date(year, month, day)
                if not m.group(3):
                    cand = _roll_future_if_past(cand)
                return cand
            except ValueError:
                return None

    return None


def _extract_date_utc(text: str) -> date | None:
    """
    Extract a calendar date (UTC) from user text.
    Supports: YYYY-MM-DD, MM/DD/YYYY (and DD/MM when valid), month names,
    numeric month/day, today, tomorrow, weekday names.
    """
    if not text:
        return None
    t = text.strip().lower()

    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d").date()
        except ValueError:
            return None

    d = _parse_numeric_slash_dates(t)
    if d:
        return d

    d = _parse_month_name_dates(t)
    if d:
        return d

    d = _parse_month_day_without_year(t)
    if d:
        return d

    if re.search(r"\btoday\b", t):
        return _utc_today()
    if re.search(r"\btomorrow\b", t):
        return _utc_today() + timedelta(days=1)
    wd = _extract_next_weekday_from_text(t)
    if wd:
        return wd
    return None


def _extract_time_utc(text: str) -> tuple[int, int] | None:
    """
    Extract a time (UTC) as (hour, minute).
    Supports: '3 pm', '3:30pm', '10 am', '15:00', '09:30', 'noon', 'midnight'
    """
    if not text:
        return None
    t = text.strip().lower()

    if re.search(r"\bnoon\b", t):
        return (12, 0)
    if re.search(r"\bmidnight\b", t):
        return (0, 0)

    # 24h: HH:MM
    m24 = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", t)
    if m24:
        return (int(m24.group(1)), int(m24.group(2)))

    # 12h: H[:MM] (a.m./p.m.) optional dot/space
    m12 = re.search(r"\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b", t)
    if not m12:
        m12 = re.search(r"\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b", t.replace(" ", ""))
    if not m12:
        return None

    hour = int(m12.group(1))
    minute = int(m12.group(2) or "0")
    ampm = (m12.group(3) or "").replace(".", "")
    if ampm.startswith("p"):
        if hour != 12:
            hour += 12
    else:
        # AM
        if hour == 12:
            hour = 0
    return (hour, minute)


def _assistant_asked_date(c: str) -> bool:
    return any(
        x in c
        for x in (
            "what date",
            "which date",
            "what day",
            "date works",
            "say today",
            "yyyy-mm-dd",
        )
    )


def _assistant_asked_service(c: str) -> bool:
    return any(
        x in c
        for x in (
            "which service",
            "what service",
            "choose one of:",
            "please choose one of:",
        )
    )


def _assistant_offered_slots(c: str) -> bool:
    return any(
        x in c
        for x in (
            "available slot",
            "available times",
            "here are the",
            "opening times",
            "slot time",
            "pick a time",
            "tell me the time",
            "time you want",
            "which time",
        )
    )


def _should_defer_booking_to_general_llm(
    in_flow: bool,
    current_text: str,
    match_service: Any,
) -> bool:
    """
    Mid-booking: if this utterance does not clearly supply date, time, or a service name,
    skip the deterministic slot machine and use the main LLM so the user gets a real answer
    (hours, chit-chat, etc.). Next turns can resume booking when they give a date/time/service.
    """
    if not in_flow:
        return False
    t = (current_text or "").strip()
    if not t:
        return False
    if match_service(t) is not None:
        return False
    if _extract_date_utc(t) is not None:
        return False
    if _extract_time_utc(t) is not None:
        return False
    return True


async def _maybe_attempt_booking_from_text(
    db: AsyncSession,
    ctx: TenantContext,
    history: list[dict[str, str]] | None,
    user_text: str,
    caller_phone: str | None,
    current_user_id: int | None,
) -> dict[str, Any] | None:
    """
    Single deterministic booking flow: date → service → list slots → pick time → book.
    Works with one question per step; also accepts date+service in one utterance when possible.
    """
    effective_history = history or []
    last_confirm_idx = -1
    for i, m in enumerate(effective_history):
        if m.get("role") == "assistant" and "you're all set for" in str(m.get("content", "")).lower():
            last_confirm_idx = i
    if last_confirm_idx >= 0:
        effective_history = effective_history[last_confirm_idx + 1 :]

    current_text = user_text or ""
    current_lower = current_text.lower().strip()
    booking_intent = bool(_BOOKING_INTENT_RE.search(current_lower))

    assistant_contents = [
        str(m.get("content", "")).lower()
        for m in effective_history
        if m.get("role") == "assistant" and m.get("content")
    ]
    offered_slots = any(_assistant_offered_slots(c) for c in assistant_contents)
    in_flow = (
        any(_assistant_asked_date(c) for c in assistant_contents)
        or any(_assistant_asked_service(c) for c in assistant_contents)
        or offered_slots
    )

    if not booking_intent and not in_flow:
        return None

    services_rows = await db.execute(
        select(Service).where(Service.tenant_id == ctx.tenant_id).order_by(Service.id)
    )
    services = [s for s in services_rows.scalars().all() if s and s.name]

    service_names = [s.name for s in services]
    if not service_names:
        return {
            "reply": "I’m sorry—no services are configured for this clinic. Please contact support.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "no_services_configured", "tool_hint": "get_services"},
            "tool_calls": [],
        }

    def match_service(text: str) -> str | None:
        norm_text = re.sub(r"[^a-z0-9]+", "", (text or "").lower())
        for s in services:
            norm_service = re.sub(r"[^a-z0-9]+", "", (s.name or "").lower())
            if norm_service and norm_service in norm_text:
                return s.name
        return None

    if _should_defer_booking_to_general_llm(
        in_flow=in_flow,
        current_text=current_text,
        match_service=match_service,
    ):
        return None

    def format_slot_time(iso_start: str) -> str:
        start_dt = datetime.fromisoformat(str(iso_start).replace("Z", "+00:00"))
        return start_dt.strftime("%I:%M %p").lstrip("0")

    # Most recent date in conversation (user messages, newest first).
    dt: date | None = None
    for m in list(reversed(effective_history)) + [{"role": "user", "content": current_text}]:
        if m.get("role") != "user":
            continue
        d_try = _extract_date_utc(str(m.get("content", "") or ""))
        if d_try:
            dt = d_try
            break

    # Step 1 — need a date
    if not dt:
        return {
            "reply": (
                "What date works for you? You can say today, tomorrow, a weekday, "
                "a calendar date like April 15 or 4/15/2026, or YYYY-MM-DD."
            ),
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "step_date", "tool_hint": "none"},
            "tool_calls": [],
        }

    if dt < _utc_today():
        return {
            "reply": "I can't book a past date. What date would you like instead?",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "past_date", "tool_hint": "none"},
            "tool_calls": [],
        }

    # Resolve service from current message, then older user turns (e.g. time-only reply after service pick).
    selected_service_name = match_service(current_text)
    if not selected_service_name:
        for m in reversed(effective_history):
            if m.get("role") != "user":
                continue
            selected_service_name = match_service(str(m.get("content", "") or ""))
            if selected_service_name:
                break

    # Step 2 — need a service
    if not selected_service_name:
        return {
            "reply": f"Which service would you like? Please choose one of: {', '.join(service_names)}.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "step_service", "tool_hint": "get_services"},
            "tool_calls": [],
        }

    service_id = await _resolve_service_id(db, ctx.tenant_id, selected_service_name, None)
    if not service_id:
        return {
            "reply": f"I didn't match that to a service. Please say one of: {', '.join(service_names)}.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "wrong_service", "tool_hint": "get_services"},
            "tool_calls": [],
        }

    # Step 3 — show slots once we have date + service and haven’t listed slots yet
    if not offered_slots:
        slots = await get_available_slots_for_service(db, service_id, dt)
        if not slots:
            return {
                "reply": "There are no openings that day for that service. Would you like to try another date?",
                "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "no_slots_for_service", "tool_hint": "get_available_slots"},
                "tool_calls": [],
            }

        times_list = [format_slot_time(s["start_time"]) for s in slots]
        times_str = ", ".join(times_list)
        return {
            "reply": (
                f"Here are the available slots for {dt.isoformat()} — {selected_service_name}: {times_str}. "
                "Please tell me the time you want."
            ),
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "step_slots", "tool_hint": "get_available_slots"},
            "tool_calls": [],
        }

    # Step 4 — slot list was shown; user picks a time (must match an offered slot)
    slots_now = await get_available_slots_for_service(db, service_id, dt)
    if not slots_now:
        return {
            "reply": "Those times are no longer available. What date would you like instead?",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "no_slots_after_refresh", "tool_hint": "get_available_slots"},
            "tool_calls": [],
        }

    tm = _extract_time_utc(current_text)
    if not tm:
        times_list = [format_slot_time(s["start_time"]) for s in slots_now]
        return {
            "reply": f"Please pick a time from these slots: {', '.join(times_list)}.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "need_time", "tool_hint": "get_available_slots"},
            "tool_calls": [],
        }

    extracted_start = datetime(dt.year, dt.month, dt.day, tm[0], tm[1], tzinfo=timezone.utc)
    slot_match = None
    for s in slots_now:
        s_start = datetime.fromisoformat(str(s["start_time"]).replace("Z", "+00:00"))
        if s_start == extracted_start:
            slot_match = s
            break

    if not slot_match:
        times_list = [format_slot_time(s["start_time"]) for s in slots_now]
        return {
            "reply": f"That time isn't available. Please choose one of: {', '.join(times_list)}.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "no_slot_match", "tool_hint": "get_available_slots"},
            "tool_calls": [],
        }

    latest_slots = await get_available_slots_for_service(db, service_id, dt)
    latest_match = None
    for s in latest_slots:
        s_start = datetime.fromisoformat(str(s["start_time"]).replace("Z", "+00:00"))
        if s_start == extracted_start:
            latest_match = s
            break

    if not latest_match:
        times_list = [format_slot_time(s["start_time"]) for s in latest_slots]
        return {
            "reply": f"That slot was just taken. Please choose one of: {', '.join(times_list)}.",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "slot_taken_after_recheck", "tool_hint": "get_available_slots"},
            "tool_calls": [],
        }

    result_json = await _run_tool(
        "create_booking",
        {
            "start_time": latest_match["start_time"],
            "end_time": latest_match["end_time"],
            "service_name": selected_service_name,
        },
        db=db,
        ctx=ctx,
        caller_phone=caller_phone,
        current_user_id=current_user_id,
    )

    try:
        result = json.loads(result_json)
    except json.JSONDecodeError:
        result = {"success": False, "error": "invalid_tool_result"}

    if result.get("success"):
        start_dt = datetime.fromisoformat(str(latest_match["start_time"]).replace("Z", "+00:00"))
        spoken_time = start_dt.strftime("%I:%M %p").lstrip("0")
        return {
            "reply": f"You're all set for {spoken_time}. We'll send a confirmation. Anything else?",
            "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 1.0, "reason": "booked", "tool_hint": "create_booking"},
            "tool_calls": [{"name": "create_booking", "result": result}],
        }

    times_list = [format_slot_time(s["start_time"]) for s in latest_slots]
    return {
        "reply": f"I couldn't complete that booking. Please choose one of: {', '.join(times_list)}.",
        "intent": {"intent": "BOOK_APPOINTMENT", "confidence": 0.0, "reason": "create_booking_failed", "tool_hint": "create_booking"},
        "tool_calls": [{"name": "create_booking", "result": result}],
    }


async def classify_intent(db: AsyncSession, ctx: TenantContext, user_text: str) -> dict[str, Any]:
    if not settings.openai_api_key:
        return {"intent": "UNKNOWN", "confidence": 0.0, "reason": "OPENAI_API_KEY not set", "tool_hint": "none"}
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an intent classifier for clinic phone assistant."},
                {"role": "user", "content": _intent_prompt(ctx, user_text)},
            ],
            temperature=0,
        )
    except RateLimitError:
        logger.warning("OpenAI rate limited while classifying intent.")
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "reason": "openai_rate_limited",
            "tool_hint": "none",
            "provider_error": "rate_limited",
        }
    except APIError:
        logger.exception("OpenAI API error while classifying intent.")
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "reason": "openai_api_error",
            "tool_hint": "none",
            "provider_error": "api_error",
        }
    raw = (response.choices[0].message.content or "{}").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {"intent": "UNKNOWN", "confidence": 0.0, "reason": "invalid JSON", "tool_hint": "none"}
    if data.get("intent") not in INTENTS:
        data["intent"] = "UNKNOWN"
    data.setdefault("confidence", 0.0)
    data.setdefault("reason", "")
    data.setdefault("tool_hint", "none")
    return data


def _tools_for_intent(intent: str) -> list[dict[str, Any]]:
    all_tools = _tool_definitions()
    if intent in {"BOOK_APPOINTMENT", "RESCHEDULE_APPOINTMENT"}:
        return [t for t in all_tools if t["function"]["name"] in {"get_services", "get_available_slots", "create_booking"}]
    if intent == "GENERAL_QUERY":
        return [t for t in all_tools if t["function"]["name"] in {"get_services", "get_business_hours"}]
    if intent == "GREETING":
        return []
    return all_tools


async def process_receptionist_turn(
    db: AsyncSession,
    tenant_key: str,
    user_text: str,
    history: list[dict[str, str]] | None = None,
    caller_phone: str | None = None,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    ctx = await resolve_tenant_context(db, tenant_key)
    if not ctx:
        return {
            "reply": "I could not find that clinic. Please confirm the clinic name.",
            "intent": {"intent": "UNKNOWN", "confidence": 0.0, "reason": "tenant not found", "tool_hint": "none"},
            "tool_calls": [],
        }

    # If the caller already provided enough details (date+time) to book,
    # do a deterministic booking first so we don't rely on the LLM to call tools.
    maybe_booking = await _maybe_attempt_booking_from_text(
        db=db,
        ctx=ctx,
        history=history,
        user_text=user_text,
        caller_phone=caller_phone,
        current_user_id=current_user_id,
    )
    if maybe_booking:
        return maybe_booking

    if not settings.openai_api_key:
        return {
            "reply": "Voice assistant is not configured yet. Please set OPENAI_API_KEY.",
            "intent": {"intent": "UNKNOWN", "confidence": 0.0, "reason": "OPENAI_API_KEY missing", "tool_hint": "none"},
            "tool_calls": [],
        }
    intent = await classify_intent(db, ctx, user_text)
    if intent.get("provider_error") == "rate_limited":
        return {
            "reply": "Our assistant is temporarily busy. Please try again in a minute.",
            "intent": intent,
            "tool_calls": [],
            "error_code": "provider_rate_limited",
        }
    if intent.get("provider_error") == "api_error":
        return {
            "reply": "Our assistant is temporarily unavailable. Please try again shortly.",
            "intent": intent,
            "tool_calls": [],
            "error_code": "provider_api_error",
        }
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    messages: list[dict[str, Any]] = [{"role": "system", "content": _agent_prompt(ctx)}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_text})
    tools = _tools_for_intent(intent["intent"])
    tool_log: list[dict[str, Any]] = []
    for _ in range(5):
        try:
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=tools or None,
                tool_choice="auto" if tools else None,
            )
        except RateLimitError:
            logger.warning("OpenAI rate limited while generating receptionist response.")
            return {
                "reply": "Our assistant is temporarily busy. Please try again in a minute.",
                "intent": intent,
                "tool_calls": tool_log,
                "error_code": "provider_rate_limited",
            }
        except APIError:
            logger.exception("OpenAI API error while generating receptionist response.")
            return {
                "reply": "Our assistant is temporarily unavailable. Please try again shortly.",
                "intent": intent,
                "tool_calls": tool_log,
                "error_code": "provider_api_error",
            }
        msg = completion.choices[0].message
        if not msg.tool_calls:
            return {"reply": (msg.content or "").strip(), "intent": intent, "tool_calls": tool_log}

        assistant_payload = {
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
                }
                for tc in msg.tool_calls
            ],
        }
        messages.append(assistant_payload)

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await _run_tool(name, args, db, ctx, caller_phone, current_user_id=current_user_id)
            tool_log.append({"name": name, "arguments": args, "result": json.loads(result)})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
    return {
        "reply": "I am sorry, I could not complete that request. Please try again.",
        "intent": intent,
        "tool_calls": tool_log,
    }
