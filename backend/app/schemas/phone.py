from pydantic import BaseModel, Field


class PhoneNumberSet(BaseModel):
    """Payload when admin sets their Twilio number."""
    phone_number: str = Field(..., min_length=10, description="E.164 or 10-digit number (e.g. +12345678900)")


class PhoneNumberResponse(BaseModel):
    """Current configured Twilio number for the tenant, or status when pending super admin assignment."""
    status: str  # "requested" | "assigned"
    phone_number: str | None = None
    twilio_phone_number_sid: str | None = None
    voice_webhook_url: str | None = None
