# LiveKit / voice receptionist — backup for restoration

This folder contains a **full snapshot** of the LiveKit-related code that was removed from the main tree so you can open a clean PR, then restore this in a follow-up branch.

## Files backed up (copy back to these paths)

| Restore to | Source in this folder |
|------------|------------------------|
| `oscar-backend/app/api/livekit.py` | `backend/app/api/livekit.py` |
| `oscar-backend/app/services/livekit_receptionist.py` | `backend/app/services/livekit_receptionist.py` |
| `oscar-backend/app/services/livekit_worker.py` | `backend/app/services/livekit_worker.py` |
| `oscar-frontend/src/api/livekit.js` | `frontend/src/api/livekit.js` |
| `oscar-frontend/src/pages/dashboard/VoiceAssistant.jsx` | `frontend/src/pages/dashboard/VoiceAssistant.jsx` |

## Wiring to re-apply after copying files

### `oscar-backend/app/main.py`

Add import:

```python
from app.api.livekit import router as livekit_router
```

Register router (with other routers):

```python
app.include_router(livekit_router, prefix="/api")
```

### `oscar-backend/app/config.py`

Inside `Settings`, add:

```python
    # LiveKit (voice transport)
    livekit_url: str = os.getenv("LIVEKIT_URL", "")
    livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")
```

### `oscar-backend/.env.example`

Restore the LiveKit block:

```
# LiveKit (real-time voice rooms)
LIVEKIT_URL=wss://your-livekit-host
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

### Frontend

1. `oscar-frontend/src/pages/dashboard/index.js` — export VoiceAssistant again:
   `export { default as VoiceAssistant } from './VoiceAssistant';`
2. `oscar-frontend/src/App.jsx` — import `VoiceAssistant` and add route:
   `<Route path="voice-agent" element={<VoiceAssistant />} />`
3. `oscar-frontend/src/components/layout/AppNav.jsx` — add user nav item:
   `{ path: '/dashboard/voice-agent', label: 'Voice Agent' }`
4. `oscar-frontend/src/pages/dashboard/UserDashboardLayout.jsx` — restore mobile tab NavLink to `/dashboard/voice-agent` (“Voice Agent”).

## Env

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env` when using token/room features; `OPENAI_API_KEY` is required for the receptionist LLM path.
