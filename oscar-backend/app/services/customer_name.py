"""Derive a display name for a booking customer from the User row."""

from app.models.user import User


def customer_name_from_user(user: User | None) -> str | None:
    if user is None:
        return None
    if user.full_name and (n := user.full_name.strip()):
        return n
    if user.email and (e := user.email.strip()):
        return e
    return None
