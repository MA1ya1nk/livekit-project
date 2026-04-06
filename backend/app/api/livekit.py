from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.livekit_receptionist import process_receptionist_turn

router = APIRouter(prefix="/livekit", tags=["livekit"])


class LivekitTokenRequest(BaseModel):
    tenant_key: str = Field(..., description="Tenant id, slug, or exact tenant name")
    participant_name: str = Field(..., description="Caller display name")
    participant_identity: str = Field(..., description="Unique participant identity")
    room_name: str = Field(..., description="Room name")


class ReceptionistTurnRequest(BaseModel):
    tenant_key: str = Field(..., description="Tenant id, slug, or exact tenant name")
    user_text: str
    caller_phone: str | None = None
    history: list[dict[str, str]] | None = None


@router.get("/health")
async def livekit_health() -> dict[str, Any]:
    return {
        "ok": True,
        "livekit_url_configured": bool(settings.livekit_url),
        "livekit_api_key_configured": bool(settings.livekit_api_key),
        "livekit_api_secret_configured": bool(settings.livekit_api_secret),
    }


@router.post("/token")
async def create_livekit_token(payload: LivekitTokenRequest) -> dict[str, str]:
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=400, detail="LiveKit credentials are missing.")

    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=1)
    claims = {
        "iss": settings.livekit_api_key,
        "sub": payload.participant_identity,
        "nbf": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "name": payload.participant_name,
        "video": {
            "roomJoin": True,
            "room": payload.room_name,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
        # Metadata lets a LiveKit worker map caller to tenant/domain.
        "metadata": f'{{"tenant_key":"{payload.tenant_key}"}}',
    }
    token = jwt.encode(claims, settings.livekit_api_secret, algorithm="HS256")
    return {"token": token, "url": settings.livekit_url}


@router.post("/receptionist/turn")
async def receptionist_turn(
    payload: ReceptionistTurnRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    result = await process_receptionist_turn(
        db=db,
        tenant_key=payload.tenant_key,
        user_text=payload.user_text,
        history=payload.history,
        caller_phone=payload.caller_phone,
        current_user_id=current_user.id,
    )
    return result
