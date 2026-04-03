from datetime import time
from pydantic import BaseModel, Field, model_validator

from app.models.service import ALLOWED_SLOT_DURATIONS


class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    managed_by: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=5000)
    price: float = Field(..., ge=0)
    slot_duration_minutes: int = Field(..., description="One of 15, 30, 45, 60")
    max_bookings_per_user_per_day: int = Field(..., ge=1, le=100)
    available_from_time: time
    available_to_time: time
    # When true, this becomes the default service pre-selected on customer booking pages.
    make_default_for_users: bool = False

    @model_validator(mode="after")
    def check_slot_duration(self):
        if self.slot_duration_minutes not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"slot_duration_minutes must be one of {ALLOWED_SLOT_DURATIONS}")
        # Availability is same-day only. If "to" is earlier than "from", that would represent next-day availability.
        if self.available_to_time <= self.available_from_time:
            raise ValueError("available_to_time must be later than available_from_time (same day only)")
        return self


class ServiceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    managed_by: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=5000)
    price: float | None = Field(None, ge=0)
    slot_duration_minutes: int | None = None
    max_bookings_per_user_per_day: int | None = Field(None, ge=1, le=100)
    available_from_time: time | None = None
    available_to_time: time | None = None
    make_default_for_users: bool | None = None

    @model_validator(mode="after")
    def check_slot_duration(self):
        if self.slot_duration_minutes is not None and self.slot_duration_minutes not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"slot_duration_minutes must be one of {ALLOWED_SLOT_DURATIONS}")
        if self.available_from_time is not None and self.available_to_time is not None:
            # Keep same-day only when both ends are provided.
            if self.available_to_time <= self.available_from_time:
                raise ValueError("available_to_time must be later than available_from_time (same day only)")
        return self


class ServiceResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    managed_by: str | None = None
    description: str | None = None
    price: float
    slot_duration_minutes: int
    max_bookings_per_user_per_day: int
    available_from_time: time
    available_to_time: time
    created_by: int | None = None

    class Config:
        from_attributes = True
