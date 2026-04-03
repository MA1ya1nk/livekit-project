from datetime import datetime, timedelta, date, timezone
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.service import Service
from app.models.booking import Booking, BookingStatus
from app.api.deps import get_current_user
from app.schemas.booking import Slot, BookingResponse, BookingCreate
from app.services.customer_name import customer_name_from_user
from app.services.slots import get_available_slots_for_service
from app.services.booking_validation import validate_slot_calendar_date, validate_booking_start_time

router = APIRouter(tags=["bookings"])


@router.get("/slots", response_model=List[Slot])
async def get_available_slots(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    date: date = Query(..., description="Date to fetch slots for (YYYY-MM-DD)"),
    service_id: int = Query(..., description="Service id (from tenant's services)"),
):
    """
    Fetch available booking slots for the given service and date.
    User's tenant must match the service's tenant.
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User is not associated with a tenant")
    svc_result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == current_user.tenant_id,
        )
    )
    service = svc_result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    err = validate_slot_calendar_date(date)
    if err:
        raise HTTPException(status_code=400, detail=err)
    slots_data = await get_available_slots_for_service(db, service_id, date)
    return [Slot(start_time=datetime.fromisoformat(s["start_time"].replace("Z", "+00:00")), end_time=datetime.fromisoformat(s["end_time"].replace("Z", "+00:00"))) for s in slots_data]

@router.post("", response_model=BookingResponse)
async def create_booking(
    booking_in: BookingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User is not associated with a tenant")
    if booking_in.start_time >= booking_in.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")
    past_err = validate_booking_start_time(booking_in.start_time)
    if past_err:
        raise HTTPException(status_code=400, detail=past_err)
    svc_result = await db.execute(
        select(Service).where(
            Service.id == booking_in.service_id,
            Service.tenant_id == current_user.tenant_id,
        )
    )
    service = svc_result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    booking_date = booking_in.start_time.date()
    day_start = datetime.combine(booking_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    count_result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.tenant_id == current_user.tenant_id,
            Booking.service_id == booking_in.service_id,
            Booking.user_id == current_user.id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.start_time >= day_start,
            Booking.start_time < day_end,
        )
    )
    daily_limit = service.max_bookings_per_user_per_day or 2
    if (count_result.scalar() or 0) >= daily_limit:
        raise HTTPException(
            status_code=400,
            detail=f"You can have at most {daily_limit} bookings per day for this service.",
        )
    overlap_query = select(Booking).where(
        and_(
            Booking.service_id == booking_in.service_id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.start_time < booking_in.end_time,
            Booking.end_time > booking_in.start_time
        )
    )
    result = await db.execute(overlap_query)
    if result.scalars().first() is not None:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    new_booking = Booking(
        tenant_id=current_user.tenant_id,
        service_id=booking_in.service_id,
        user_id=current_user.id,
        start_time=booking_in.start_time,
        end_time=booking_in.end_time,
    )
    db.add(new_booking)
    await db.commit()
    await db.refresh(new_booking)
    return BookingResponse(
        id=new_booking.id,
        tenant_id=new_booking.tenant_id,
        service_id=new_booking.service_id,
        service_name=service.name,
        service_price=float(service.price) if service.price is not None else None,
        user_id=new_booking.user_id,
        guest_phone=new_booking.guest_phone,
        customer_name=customer_name_from_user(current_user),
        start_time=new_booking.start_time,
        end_time=new_booking.end_time,
        status=new_booking.status,
        source=new_booking.source,
        created_at=new_booking.created_at,
        updated_at=new_booking.updated_at,
    )

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_booking(
    booking_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # Allow user who made it or admin of the same tenant to cancel
    from app.models.user import UserRole
    if booking.user_id != current_user.id:
        if current_user.role != UserRole.ADMIN or current_user.tenant_id != booking.tenant_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
        
    booking.status = BookingStatus.CANCELLED
    await db.commit()
