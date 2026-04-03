"""Shared rules: no past calendar dates for slots; no past start times for bookings."""
from datetime import datetime, date, timezone


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def validate_slot_calendar_date(for_date: date) -> str | None:
    """Return error message if the day is before today (UTC); else None."""
    if for_date < utc_today():
        return "Appointments cannot be booked for past dates."
    return None


def validate_booking_start_time(start_time: datetime) -> str | None:
    """Return error message if start is in the past (UTC); else None."""
    st = ensure_utc(start_time)
    now = datetime.now(timezone.utc)
    if st.date() < utc_today():
        return "Cannot book on a past date."
    if st < now:
        return "Cannot book a time in the past."
    return None
