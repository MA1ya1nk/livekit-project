"""
Twilio Voice webhooks: incoming call and gather (speech) callback.
Maps call to tenant, runs AI agent, returns TwiML.
"""
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qs
from typing import Annotated

from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.twiml.voice_response import VoiceResponse, Gather

from app.database import get_db
from app.config import settings
from app.models.tenant import Tenant
from app.models.service import Service
from app.models.voice_call import VoiceCall
from app.core.twilio_client import normalize_phone_for_twilio, get_voice_webhook_url, validate_twilio_request
from app.core.call_state import call_state_get, call_state_set, call_state_delete
from app.services.voice_agent import run_agent

router = APIRouter(prefix="/voice", tags=["voice"])
logger = logging.getLogger(__name__)

END_CALL_MARKER = "[END_CALL]"


async def get_twilio_form(request: Request) -> dict:
    """Read POST body, validate Twilio signature, return form dict. Raises 403 if invalid."""
    body = await request.body()
    if settings.twilio_auth_token:
        signature = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        if not validate_twilio_request(url, body, signature):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")
    params = parse_qs(body.decode("utf-8"), keep_blank_values=True)
    return {k: (v[0] if isinstance(v, list) and v else v) for k, v in params.items()}


def _twiml(s: str) -> Response:
    return Response(content=s, media_type="application/xml")


def _twiml_response(response: VoiceResponse) -> Response:
    return Response(content=str(response), media_type="application/xml")


@router.post("/incoming")
async def voice_incoming(
    db: Annotated[AsyncSession, Depends(get_db)],
    form: Annotated[dict, Depends(get_twilio_form)],
):
    """
    Twilio calls this when someone dials the tenant's number. We answer, say welcome, and Gather speech.
    """
    CallSid = form.get("CallSid", "")
    From = form.get("From", "")
    To = form.get("To", "")
    normalized_to = normalize_phone_for_twilio(To)
    result = await db.execute(
        select(Tenant).where(Tenant.twilio_phone_number == normalized_to).limit(1)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        # Fallback: existing rows may have non-normalized number
        all_result = await db.execute(
            select(Tenant).where(Tenant.twilio_phone_number_sid.isnot(None))
        )
        for t in all_result.scalars().all():
            if t.twilio_phone_number and normalize_phone_for_twilio(t.twilio_phone_number) == normalized_to:
                tenant = t
                break
    if not tenant:
        logger.info(
            "[%s] voice.incoming | CallSid=%s | From=%s | To=%s | tenant=none (number not configured)",
            datetime.now(timezone.utc).isoformat(), CallSid, From, To,
        )
        resp = VoiceResponse()
        resp.say("This number is not configured for booking. Goodbye.")
        resp.hangup()
        return _twiml_response(resp)
    logger.info(
        "[%s] voice.incoming | CallSid=%s | From=%s | To=%s | tenant_id=%s | tenant_name=%s",
        datetime.now(timezone.utc).isoformat(), CallSid, From, To, tenant.id, tenant.name,
    )
    voice_call = VoiceCall(
        tenant_id=tenant.id,
        call_sid=CallSid,
        from_number=From,
        to_number=To,
        status="in-progress",
        started_at=datetime.now(timezone.utc),
    )
    db.add(voice_call)
    await db.commit()
    await db.refresh(voice_call)
    first_svc = await db.execute(
        select(Service).where(Service.tenant_id == tenant.id).order_by(Service.id).limit(1)
    )
    default_service = first_svc.scalar_one_or_none()
    await call_state_set(CallSid, {
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "service_id": default_service.id if default_service else None,
        "messages": [],
        "voice_call_id": voice_call.id,
    })
    action_url = get_voice_webhook_url("/api/voice/gather")
    resp = VoiceResponse()
    resp.say(f"Hello, you have reached {tenant.name}. How can I help you today?")
    gather = Gather(input="speech", action=action_url, method="POST", speech_timeout=4, timeout=10)
    resp.append(gather)
    resp.say("I did not hear anything. Thanks for calling. Goodbye.")
    resp.hangup()
    return _twiml_response(resp)


@router.post("/gather", name="voice_gather")
async def voice_gather(
    db: Annotated[AsyncSession, Depends(get_db)],
    form: Annotated[dict, Depends(get_twilio_form)],
):
    """
    Twilio calls this after the user speaks (Gather). We run the agent and return Say + next Gather.
    """
    CallSid = form.get("CallSid", "")
    From = form.get("From", "")
    SpeechResult = (form.get("SpeechResult") or "").strip()
    state = await call_state_get(CallSid)
    if not state:
        logger.warning("[%s] voice.gather | CallSid=%s | no state (session expired)", datetime.now(timezone.utc).isoformat(), CallSid)
        resp = VoiceResponse()
        resp.say("Session expired. Goodbye.")
        resp.hangup()
        return _twiml_response(resp)
    user_text = SpeechResult or "I didn't catch that."
    state["messages"] = state.get("messages", []) + [{"role": "user", "content": user_text}]
    turn = (len(state.get("messages", [])) + 1) // 2
    logger.info(
        "[%s] voice.gather | CallSid=%s | turn=%s | user said: %s",
        datetime.now(timezone.utc).isoformat(), CallSid, turn, user_text,
    )
    try:
        reply = await run_agent(
            messages=state["messages"].copy(),
            tenant_id=state["tenant_id"],
            tenant_name=state["tenant_name"],
            service_id=state.get("service_id"),
            guest_phone=From,
            db=db,
            voice_call_id=state.get("voice_call_id"),
        )
    except Exception as e:
        logger.exception("[%s] voice.gather | CallSid=%s | run_agent failed: %s", datetime.now(timezone.utc).isoformat(), CallSid, e)
        reply = "I'm having trouble right now. Please call back in a moment."
    state["messages"] = state.get("messages", []) + [{"role": "assistant", "content": reply}]
    await call_state_set(CallSid, state)
    reply_clean = reply.replace(END_CALL_MARKER, "").strip()
    logger.info(
        "[%s] voice.gather | CallSid=%s | turn=%s | agent said: %s | end_call=%s",
        datetime.now(timezone.utc).isoformat(), CallSid, turn, reply_clean, END_CALL_MARKER in reply,
    )
    resp = VoiceResponse()
    resp.say(reply_clean)
    if END_CALL_MARKER in reply:
        resp.hangup()
        return _twiml_response(resp)
    action_url = get_voice_webhook_url("/api/voice/gather")
    gather = Gather(input="speech", action=action_url, method="POST", speech_timeout=4, timeout=10)
    resp.append(gather)
    resp.say("Thanks for calling. Goodbye.")
    resp.hangup()
    return _twiml_response(resp)


@router.post("/status")
async def voice_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    form: Annotated[dict, Depends(get_twilio_form)],
):
    """
    Twilio status callback when call ends. We update VoiceCall and clear call state.
    """
    CallSid = form.get("CallSid", "")
    CallStatus = form.get("CallStatus", "")
    CallDuration = form.get("CallDuration", "0")
    logger.info(
        "[%s] voice.status | CallSid=%s | status=%s | duration=%s",
        datetime.now(timezone.utc).isoformat(), CallSid, CallStatus, CallDuration,
    )
    result = await db.execute(select(VoiceCall).where(VoiceCall.call_sid == CallSid))
    voice_call = result.scalar_one_or_none()
    if voice_call:
        voice_call.status = CallStatus
        voice_call.ended_at = datetime.now(timezone.utc)
        try:
            voice_call.duration_seconds = int(CallDuration)
        except ValueError:
            pass
        await db.commit()
    await call_state_delete(CallSid)
    return Response(content="", status_code=200)
