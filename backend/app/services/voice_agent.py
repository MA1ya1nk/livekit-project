"""
Voice AI agent: LLM with scheduling tools (get_available_slots, create_booking).
Uses OpenAI chat completions with function/tool calling.
"""
import json
from datetime import datetime, date
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.booking import Booking, BookingStatus, BookingSource
from app.models.service import Service
from app.models.voice_call import VoiceCall
from app.services.slots import get_available_slots_for_service
from app.services.booking_validation import validate_slot_calendar_date, validate_booking_start_time


OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_available_slots",
            "description": "Get available appointment slots for a given date. Returns slots list and a speech_summary - use speech_summary to tell the caller in one short sentence. Date must be YYYY-MM-DD.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": "Create a booking. Use the exact start_time and end_time from the slots list that match what the caller said (e.g. '3 pm' -> slot with 15:00 start). Times in ISO 8601.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_time": {"type": "string", "description": "Start time ISO 8601 from slots"},
                    "end_time": {"type": "string", "description": "End time ISO 8601 from slots"},
                },
                "required": ["start_time", "end_time"],
            },
        },
    },
]


def _system_prompt(tenant_name: str) -> str:
    return f"""You are the friendly phone assistant for {tenant_name}. You help callers book appointments. Keep replies short and natural for a phone call (one or two sentences).

Booking flow:
1. If they want to book, ask which day only if they have not already said it. If they said "today" or "tomorrow" (or "this afternoon", "tomorrow morning"), use that immediately - do NOT ask for the day again. Map "today" to {date.today().isoformat()}, "tomorrow" to the next day.
2. Call get_available_slots for that date. The "speech_summary" is a short sentence (e.g. "We have openings from 9 AM to 5 PM today. Which time works for you?"). Say it as-is or in your own words. Do NOT read out a long list of times.
3. When they pick a time (e.g. "3:30", "3 pm", "2:30"), find the matching slot in the slots list and call create_booking with that slot's start_time and end_time.
4. If create_booking returns an error that the slot was "taken" or "already booked": do NOT say goodbye. Say that time is no longer available, then call get_available_slots again for the SAME date to get the current list, and tell them the updated available times. Ask which other time they would like. Keep the conversation going.
5. After a successful booking, say "You're all set for [time]. We'll send a confirmation. Anything else?" Only say goodbye when they say no, that's all, or goodbye.

Critical: Never say goodbye when (a) the caller is choosing a time, (b) the slot they chose was already taken - instead offer other times, (c) they said "I didn't catch that" or similar. Only say goodbye when they clearly say they are done (e.g. "no", "that's all", "goodbye", "thank you", "thanks", "all done", "hang up") or after you confirmed a booking and they said nothing else.

When the caller indicates they are done (goodbye, thanks, that's all, no, nothing else, thank you, all finished), reply with a brief goodbye (e.g. "Thanks for calling. Goodbye!") and end your reply with exactly [END_CALL] on a new line so we end the call. Do not add [END_CALL] at any other time.

Today's date is {date.today().isoformat()}. Use YYYY-MM-DD for dates and ISO 8601 for times in tool calls."""


async def _run_tool(
    name: str,
    arguments: dict,
    tenant_id: int,
    service_id: int | None,
    guest_phone: str,
    db: AsyncSession,
    voice_call_id: int | None = None,
) -> str:
    if name == "get_available_slots":
        if not service_id:
            return json.dumps({"error": "No service configured for this business. Please add a service in the dashboard."})
        d = arguments.get("date", "")
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            return json.dumps({"error": "Invalid date. Use YYYY-MM-DD."})
        past_d = validate_slot_calendar_date(dt)
        if past_d:
            return json.dumps({"error": past_d})
        slots = await get_available_slots_for_service(db, service_id, dt)
        if not slots:
            return json.dumps({
                "slots": [],
                "date": d,
                "speech_summary": "We have no openings on that day. Would you like another date?",
            })
        first = datetime.fromisoformat(slots[0]["start_time"].replace("Z", "+00:00"))
        last = datetime.fromisoformat(slots[-1]["end_time"].replace("Z", "+00:00"))

        def _ampm(h: int, m: int) -> str:
            if h == 0:
                return f"12:{m:02d} AM" if m else "12 AM"
            if h < 12:
                return f"{h}:{m:02d} AM" if m else f"{h} AM"
            if h == 12:
                return f"12:{m:02d} PM" if m else "12 PM"
            return f"{h - 12}:{m:02d} PM" if m else f"{h - 12} PM"

        range_str = _ampm(first.hour, first.minute) + " to " + _ampm(last.hour, last.minute)
        speech_summary = f"We have openings from {range_str}. Which time works for you?"
        return json.dumps({
            "slots": slots,
            "date": d,
            "speech_summary": speech_summary,
        })

    if name == "create_booking":
        if not service_id:
            return json.dumps({"error": "No service configured for this business."})
        start_s = arguments.get("start_time", "")
        end_s = arguments.get("end_time", "")
        try:
            start_time = datetime.fromisoformat(start_s.replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(end_s.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return json.dumps({"error": "Invalid start_time or end_time."})
        if start_time >= end_time:
            return json.dumps({"error": "Start must be before end."})
        past_s = validate_booking_start_time(start_time)
        if past_s:
            return json.dumps({"error": past_s})
        from datetime import timedelta, timezone as tz
        from sqlalchemy import select, and_, func
        svc_result = await db.execute(
            select(Service).where(
                Service.id == service_id,
                Service.tenant_id == tenant_id,
            )
        )
        service = svc_result.scalar_one_or_none()
        if not service:
            return json.dumps({"error": "Service not found for this business."})
        day_start = datetime.combine(start_time.date(), datetime.min.time()).replace(tzinfo=tz.utc)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.tenant_id == tenant_id,
                Booking.service_id == service_id,
                Booking.guest_phone == guest_phone,
                Booking.status != BookingStatus.CANCELLED,
                Booking.start_time >= day_start,
                Booking.start_time < day_end,
            )
        )
        daily_limit = service.max_bookings_per_user_per_day or 2
        if (count_result.scalar() or 0) >= daily_limit:
            return json.dumps({
                "error": f"You already have {daily_limit} appointments booked for that day for this service.",
            })
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
            return json.dumps({
                "error": "That time is already booked. Call get_available_slots again for the same date to get current available times, then tell the caller the updated list and ask which other time they want. Do not say goodbye.",
                "slot_taken": True,
            })
        booking = Booking(
            tenant_id=tenant_id,
            service_id=service_id,
            user_id=None,
            guest_phone=guest_phone,
            start_time=start_time,
            end_time=end_time,
            status=BookingStatus.CONFIRMED,
            source=BookingSource.VOICE,
        )
        db.add(booking)
        await db.flush()
        if voice_call_id:
            voice_call = await db.get(VoiceCall, voice_call_id)
            if voice_call:
                voice_call.booking_id = booking.id
                await db.flush()
        return json.dumps({
            "success": True,
            "message": f"Booked for {start_time.strftime('%I:%M %p')} on {start_time.strftime('%A, %B %d')}.",
            "booking_id": booking.id,
        })

    return json.dumps({"error": f"Unknown tool: {name}"})


async def run_agent(
    messages: list[dict[str, Any]],
    tenant_id: int,
    tenant_name: str,
    service_id: int | None,
    guest_phone: str,
    db: AsyncSession,
    voice_call_id: int | None = None,
) -> str:
    """
    Run the voice agent: send messages to OpenAI with tools, execute any tool calls,
    repeat until we have a final text response. Returns the assistant's reply text.
    """
    if not settings.openai_api_key:
        return "Our booking system is temporarily unavailable. Please try again later."
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    system = _system_prompt(tenant_name)
    all_messages = [{"role": "system", "content": system}] + messages
    max_rounds = 5
    for _ in range(max_rounds):
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=all_messages,
            tools=OPENAI_TOOLS,
            tool_choice="auto",
        )
        choice = response.choices[0]
        msg = choice.message
        if not msg.tool_calls:
            return (msg.content or "").strip()
        tool_calls = msg.tool_calls
        assistant_msg = {"role": "assistant", "content": msg.content or ""}
        assistant_msg["tool_calls"] = [
            {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"}}
            for tc in tool_calls
        ]
        all_messages.append(assistant_msg)
        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await _run_tool(name, args, tenant_id, service_id, guest_phone, db, voice_call_id)
            all_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })
    return "I'm sorry, I couldn't complete that. Please try again or call back later."
