from typing import Annotated, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.booking import Booking
from app.models.booking import BookingStatus
from app.models.service import Service
from app.api.deps import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.booking import BookingResponse
from app.services.customer_name import customer_name_from_user


router = APIRouter(tags=["users"])

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Fetch the current user's profile.
    """
    twilio_phone_number = None
    tenant_name = None
    default_service_id = None
    if current_user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            twilio_phone_number = tenant.twilio_phone_number
            tenant_name = tenant.name
            default_service_id = tenant.default_service_id
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        twilio_phone_number=twilio_phone_number,
        tenant_name=tenant_name,
        default_service_id=default_service_id,
    )

@router.get("/bookings", response_model=List[BookingResponse])
async def get_my_bookings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: Annotated[Literal["active", "cancelled"], Query(alias="status", description="Filter bookings by status")] = "active",
):
    """
    Fetch all bookings for the current user.
    """
    query = select(Booking).where(Booking.user_id == current_user.id)
    if status_filter == "cancelled":
        query = query.where(Booking.status == BookingStatus.CANCELLED)
    else:
        query = query.where(Booking.status != BookingStatus.CANCELLED)
    result = await db.execute(query.order_by(Booking.start_time.desc()))
    bookings = result.scalars().all()
    if not bookings:
        return []
    service_ids = list({b.service_id for b in bookings})
    svc_result = await db.execute(select(Service).where(Service.id.in_(service_ids)))
    services_map = {s.id: s for s in svc_result.scalars().all()}
    display_name = customer_name_from_user(current_user)
    return [
        BookingResponse(
            id=b.id,
            tenant_id=b.tenant_id,
            service_id=b.service_id,
            service_name=(services_map[b.service_id].name if b.service_id in services_map else None),
            service_price=(float(services_map[b.service_id].price) if b.service_id in services_map and services_map[b.service_id].price is not None else None),
            user_id=b.user_id,
            guest_phone=b.guest_phone,
            customer_name=display_name,
            start_time=b.start_time,
            end_time=b.end_time,
            status=b.status,
            source=b.source,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )
        for b in bookings
    ]


