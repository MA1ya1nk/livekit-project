import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
from app.api.auth import router as auth_router
from app.api.tenants import router as tenants_router
from app.api.admin import router as admin_router
from app.api.bookings import router as bookings_router
from app.api.users import router as users_router
from app.api.voice import router as voice_router
from app.api.superadmin import router as superadmin_router

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(tenants_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(bookings_router, prefix="/api/bookings")
app.include_router(users_router, prefix="/api/users")
app.include_router(voice_router, prefix="/api")
app.include_router(superadmin_router, prefix="/api/superadmin")

@app.get("/")
def root():
    return {"message": "AI Assisted Booking System", "docs": "/docs"}

