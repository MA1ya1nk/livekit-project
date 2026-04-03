"""
Twilio client helpers: validate that a number is in our account and set its Voice webhook URL.
"""
from urllib.parse import parse_qs

from twilio.rest import Client
from twilio.request_validator import RequestValidator

from app.config import settings


def get_twilio_client() -> Client | None:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return None
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def normalize_phone_for_twilio(phone: str) -> str:
    """Normalize to E.164 for comparison (e.g. +1234567890)."""
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return phone
    if len(digits) == 10 and not phone.strip().startswith("+"):
        return "+1" + digits
    if not phone.strip().startswith("+"):
        return "+" + digits
    return "+" + digits


def find_incoming_phone_number(phone: str) -> dict | None:
    """
    Check if the given phone number exists in our Twilio account (IncomingPhoneNumbers).
    Uses server-side filter to fetch only that number. Returns SID and details if found.
    """
    client = get_twilio_client()
    if not client:
        return None
    normalized = normalize_phone_for_twilio(phone)
    try:
        numbers = client.incoming_phone_numbers.list(phone_number=normalized)
        if not numbers:
            return None
        num = numbers[0]
        return {"sid": num.sid, "phone_number": num.phone_number}
    except Exception:
        return None


def set_voice_url(
    phone_number_sid: str,
    voice_url: str,
    voice_method: str = "POST",
    status_callback_url: str | None = None,
) -> bool:
    """
    Set the Voice URL (and method) for an existing Twilio number.
    Optionally set status_callback_url for call lifecycle events (e.g. completed).
    Returns True on success, False on failure.
    """
    client = get_twilio_client()
    if not client:
        return False
    try:
        kwargs = {"voice_url": voice_url, "voice_method": voice_method}
        if status_callback_url:
            kwargs["status_callback"] = status_callback_url
            kwargs["status_callback_method"] = "POST"
        client.incoming_phone_numbers(phone_number_sid).update(**kwargs)
        return True
    except Exception:
        return False


def get_voice_webhook_url(path: str = "/api/voice/incoming") -> str:
    """Build full webhook URL for Twilio (incoming call)."""
    base = settings.voice_webhook_base_url.rstrip("/")
    return f"{base}{path}"


def validate_twilio_request(url: str, body_bytes: bytes, signature: str) -> bool:
    """
    Validate Twilio webhook signature. Use the full request URL and raw POST body.
    Returns True if valid. When auth token is missing, returns False (reject).
    """
    if not settings.twilio_auth_token:
        return False
    validator = RequestValidator(settings.twilio_auth_token)
    # Parse form body to dict; Twilio expects single-valued params
    params = parse_qs(body_bytes.decode("utf-8"), keep_blank_values=True)
    params_flat = {k: (v[0] if isinstance(v, list) and v else v) for k, v in params.items()}
    return validator.validate(url, params_flat, signature)
