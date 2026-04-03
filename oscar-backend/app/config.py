from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # App
    app_name: str = "AI Assisted Booking System"
    debug: bool = os.getenv("DEBUG", False)

    # Database
    database_url: str = os.getenv("DATABASE_URL", None)
    alembic_database_url: str = os.getenv("ALEMBIC_DATABASE_URL", None)

    # JWT
    secret_key: str = os.getenv("SECRET_KEY", None)
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))  # 24h
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))

    # SendGrid
    sendgrid_api_key: str = os.getenv("SENDGRID_API_KEY", "")
    sendgrid_from_email: str = os.getenv("SENDGRID_FROM_EMAIL", "noreply@example.com")
    # Frontend URL for reset link, e.g. https://app.example.com/reset-password?token=
    frontend_reset_password_url: str = os.getenv("FRONTEND_RESET_PASSWORD_URL", "http://localhost:3000/reset-password?token=")
    password_reset_token_expire_minutes: int = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "60"))

    # Twilio (voice)
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    voice_webhook_base_url: str = os.getenv("VOICE_WEBHOOK_BASE_URL", "")

    # OpenAI (voice agent)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

    # LiveKit (voice transport)
    livekit_url: str = os.getenv("LIVEKIT_URL", "")
    livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")

    # Redis (voice call state; optional — falls back to in-memory if not set)
    redis_url: str = os.getenv("REDIS_URL", "")
    
    superadmin_email: str
    superadmin_password: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
