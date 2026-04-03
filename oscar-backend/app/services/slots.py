"""
Reusable slot calculation per service. Used by the bookings API and the voice agent.
Slot duration comes from the service; working hours from the tenant.
"""
from datetime import datetime, timedelta, date, timezone
from typing import List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.models.booking import Booking, BookingStatus
from app.services.booking_validation import utc_today


async def get_available_slots_for_service(
    db: AsyncSession,
    service_id: int,
    for_date: date,
) -> List[dict]:
    """
    Returns list of available slots for the given service and date.
    Each slot is {"start_time": "ISO8601", "end_time": "ISO8601"} in UTC.
    Past calendar days return no slots; for today, only future slots are returned.
    """
    if for_date < utc_today():
        return []

    svc_result = await db.execute(select(Service).where(Service.id == service_id))
    service = svc_result.scalar_one_or_none()
    if not service:
        return []

    service_start_dt = datetime.combine(for_date, service.available_from_time).replace(tzinfo=timezone.utc)
    service_end_dt = datetime.combine(for_date, service.available_to_time).replace(tzinfo=timezone.utc)
    # Same-day only: if end is earlier (or equal), treat as invalid and return no slots.
    # This prevents showing next-day time ranges like 9:00 AM -> 5:00 AM.
    if service_end_dt <= service_start_dt:
        return []

    start_dt = service_start_dt
    end_dt = service_end_dt

    slot_duration = timedelta(minutes=service.slot_duration_minutes)
    bookings_result = await db.execute(
        select(Booking).where(
            and_(
                Booking.service_id == service_id,
                Booking.start_time >= start_dt,
                Booking.start_time < end_dt,
                Booking.status != BookingStatus.CANCELLED,
            )
        )
    )
    existing_bookings = bookings_result.scalars().all()
    slots = []
    current_time = start_dt
    while current_time + slot_duration <= end_dt:
        slot_end = current_time + slot_duration
        overlap = False
        for b in existing_bookings:
            b_start = b.start_time if b.start_time.tzinfo else b.start_time.replace(tzinfo=timezone.utc)
            b_end = b.end_time if b.end_time.tzinfo else b.end_time.replace(tzinfo=timezone.utc)
            if max(current_time, b_start) < min(slot_end, b_end):
                overlap = True
                break
        if not overlap:
            slots.append({
                "start_time": current_time.isoformat(),
                "end_time": slot_end.isoformat(),
            })
        current_time += slot_duration

    if for_date == utc_today():
        now = datetime.now(timezone.utc)
        slots = [
            s
            for s in slots
            if datetime.fromisoformat(s["start_time"].replace("Z", "+00:00")) > now
        ]
    return slots
