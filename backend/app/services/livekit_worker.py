"""
LiveKit worker entrypoint for real-time voice receptionist.

This worker is optional and requires livekit-agents packages:
  pip install livekit-agents livekit-plugins-openai
"""

import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


async def run_receptionist_turn_from_metadata(
    db,
    transcript_text: str,
    participant_metadata: str | None,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Bridge method that LiveKit handlers can call after STT.
    tenant_key is read from participant metadata JSON: {"tenant_key":"..."}.
    """
    from app.services.livekit_receptionist import process_receptionist_turn

    tenant_key = ""
    if participant_metadata:
        try:
            metadata = json.loads(participant_metadata)
            tenant_key = str(metadata.get("tenant_key", "")).strip()
        except json.JSONDecodeError:
            tenant_key = ""
    if not tenant_key:
        return {
            "reply": "I could not identify your clinic context. Please reconnect from the clinic portal.",
            "intent": {"intent": "UNKNOWN", "confidence": 0.0, "reason": "missing tenant_key metadata", "tool_hint": "none"},
            "tool_calls": [],
        }
    return await process_receptionist_turn(
        db=db,
        tenant_key=tenant_key,
        user_text=transcript_text,
        history=history,
        current_user_id=None,
    )


def validate_livekit_env() -> None:
    missing = []
    if not settings.livekit_url:
        missing.append("LIVEKIT_URL")
    if not settings.livekit_api_key:
        missing.append("LIVEKIT_API_KEY")
    if not settings.livekit_api_secret:
        missing.append("LIVEKIT_API_SECRET")
    if missing:
        logger.warning("LiveKit env missing: %s", ", ".join(missing))
