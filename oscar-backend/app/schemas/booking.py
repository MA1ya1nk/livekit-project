from datetime import datetime
from pydantic import BaseModel
from app.models.booking import BookingStatus, BookingSource

class Slot(BaseModel):
    start_time: datetime
    end_time: datetime

class BookingBase(BaseModel):
    start_time: datetime
    end_time: datetime


class BookingCreate(BookingBase):
    service_id: int


class BookingResponse(BookingBase):
    id: int
    tenant_id: int
    service_id: int
    service_name: str | None = None
    service_price: float | None = None
    user_id: int | None
    guest_phone: str | None
    customer_name: str | None = None
    status: BookingStatus
    source: BookingSource
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
