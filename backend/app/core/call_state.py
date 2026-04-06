"""
Call state for voice: Redis-backed so it works across workers. Falls back to in-memory if REDIS_URL not set.
"""
import json
from typing import Any

from app.config import settings

# In-memory fallback when Redis is not configured (single-worker / dev)
_memory: dict[str, dict[str, Any]] = {}
_TTL_SECONDS = 3600  # 1 hour


def _serialize(state: dict[str, Any]) -> str:
    return json.dumps(state, default=str)


def _deserialize(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def call_state_get(call_sid: str) -> dict[str, Any] | None:
    if settings.redis_url:
        try:
            from redis.asyncio import Redis
            client = Redis.from_url(settings.redis_url, decode_responses=True)
            try:
                data = await client.get(f"voice_call:{call_sid}")
                return _deserialize(data) if data else None
            finally:
                await client.aclose()
        except Exception:
            return _memory.get(call_sid)
    return _memory.get(call_sid)


async def call_state_set(call_sid: str, state: dict[str, Any]) -> None:
    if settings.redis_url:
        try:
            from redis.asyncio import Redis
            client = Redis.from_url(settings.redis_url, decode_responses=True)
            try:
                await client.setex(
                    f"voice_call:{call_sid}",
                    _TTL_SECONDS,
                    _serialize(state),
                )
            finally:
                await client.aclose()
        except Exception:
            _memory[call_sid] = state
    else:
        _memory[call_sid] = state


async def call_state_delete(call_sid: str) -> None:
    if settings.redis_url:
        try:
            from redis.asyncio import Redis
            client = Redis.from_url(settings.redis_url, decode_responses=True)
            try:
                await client.delete(f"voice_call:{call_sid}")
            finally:
                await client.aclose()
        except Exception:
            _memory.pop(call_sid, None)
    else:
        _memory.pop(call_sid, None)
