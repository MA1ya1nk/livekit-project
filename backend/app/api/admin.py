from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.working_hours import WorkingHours
from app.models.service import Service
from app.models.booking import Booking
from app.models.number_request import NumberRequest, NumberRequestStatus
from app.api.deps import get_current_admin
from app.schemas.working_hours import WorkingHoursResponse, WorkingHoursBulkUpdate
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.schemas.auth import UserResponse
from app.schemas.booking import BookingResponse
from app.services.customer_name import customer_name_from_user
from app.schemas.phone import PhoneNumberResponse
from app.core.twilio_client import get_voice_webhook_url

router = APIRouter(tags=["admin"])
@router.get("/phone-number", response_model=PhoneNumberResponse)
async def get_phone_number(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Get phone number status: assigned (with number) or requested (pending super admin)."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.twilio_phone_number and tenant.twilio_phone_number_sid:
        return PhoneNumberResponse(
            status="assigned",
            phone_number=tenant.twilio_phone_number,
            twilio_phone_number_sid=tenant.twilio_phone_number_sid,
            voice_webhook_url=get_voice_webhook_url(),
        )
    return PhoneNumberResponse(
        status="requested",
        phone_number=None,
        twilio_phone_number_sid=None,
        voice_webhook_url=None,
    )


@router.post("/phone-number/request")
async def request_phone_number(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Request a phone number from super admin. Creates a pending request until super admin assigns one."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    # If tenant already has a number, no need to request
    result = await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.twilio_phone_number:
        raise HTTPException(status_code=400, detail="Tenant already has a number assigned")
    # One pending request per tenant
    pending_result = await db.execute(
        select(NumberRequest).where(
            NumberRequest.tenant_id == current_admin.tenant_id,
            NumberRequest.status == NumberRequestStatus.REQUESTED,
        )
    )
    if pending_result.scalars().first():
        raise HTTPException(status_code=400, detail="Number already requested, pending super admin assignment")
    req = NumberRequest(tenant_id=current_admin.tenant_id, status=NumberRequestStatus.REQUESTED)
    db.add(req)
    await db.commit()
    return {"message": "Number request submitted. Super admin will assign a number."}


@router.get("/services", response_model=List[ServiceResponse])
async def list_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """List all services for the admin's tenant."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(
        select(Service).where(Service.tenant_id == current_admin.tenant_id).order_by(Service.id)
    )
    return result.scalars().all()


@router.post("/services", response_model=ServiceResponse)
async def create_service(
    body: ServiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Add a service (e.g. Dental, Skin)."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    if body.available_to_time <= body.available_from_time:
        raise HTTPException(
            status_code=400,
            detail="available_to_time must be later than available_from_time (same day only)",
        )
    service = Service(
        tenant_id=current_admin.tenant_id,
        name=body.name.strip(),
        managed_by=body.managed_by.strip() if body.managed_by else None,
        description=body.description.strip() if body.description else None,
        price=body.price,
        slot_duration_minutes=body.slot_duration_minutes,
        max_bookings_per_user_per_day=body.max_bookings_per_user_per_day,
        available_from_time=body.available_from_time,
        available_to_time=body.available_to_time,
        created_by=current_admin.id,
    )
    db.add(service)
    # Get service.id for default_service_id assignment before commit.
    await db.flush()
    if body.make_default_for_users:
        tenant_row = (await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))).scalar_one_or_none()
        if tenant_row:
            tenant_row.default_service_id = service.id
    await db.commit()
    await db.refresh(service)
    return service


@router.get("/services/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Get a service by id (must belong to admin's tenant)."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == current_admin.tenant_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.put("/services/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    body: ServiceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Update a service."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == current_admin.tenant_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if body.name is not None:
        service.name = body.name.strip()
    if body.managed_by is not None:
        service.managed_by = body.managed_by.strip() if body.managed_by else None
    if body.description is not None:
        service.description = body.description.strip() if body.description else None
    if body.price is not None:
        service.price = body.price
    if body.slot_duration_minutes is not None:
        service.slot_duration_minutes = body.slot_duration_minutes
    if body.max_bookings_per_user_per_day is not None:
        service.max_bookings_per_user_per_day = body.max_bookings_per_user_per_day
    if body.available_from_time is not None:
        service.available_from_time = body.available_from_time
    if body.available_to_time is not None:
        service.available_to_time = body.available_to_time
    if service.available_to_time <= service.available_from_time:
        raise HTTPException(
            status_code=400,
            detail="available_to_time must be later than available_from_time (same day only)",
        )
    if body.make_default_for_users is not None:
        # Set (or clear) the tenant default for customer booking page.
        tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            if body.make_default_for_users:
                tenant.default_service_id = service.id
            elif tenant.default_service_id == service.id:
                tenant.default_service_id = None
    await db.commit()
    await db.refresh(service)
    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)],
):
    """Delete a service. Fails if there are existing bookings for it."""
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == current_admin.tenant_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).select_from(Booking).where(Booking.service_id == service_id)
    )
    if (count_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete service with existing bookings",
        )
    # If this is the current default service for the tenant, clear it first.
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant and tenant.default_service_id == service_id:
        tenant.default_service_id = None
    await db.delete(service)
    await db.commit()


@router.get("/working-hours", response_model=List[WorkingHoursResponse])
async def get_working_hours(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)]
):
    """
    Fetch the current 7-day schedule for the admin's tenant.
    """
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    
    result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.tenant_id == current_admin.tenant_id)
        .order_by(WorkingHours.day_of_week)
    )
    return result.scalars().all()

@router.put("/working-hours", response_model=List[WorkingHoursResponse])
async def update_working_hours(
    bulk_update: WorkingHoursBulkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)]
):
    """
    Bulk update the 7-day schedule for the admin's tenant.
    """
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    
    days = [wh.day_of_week for wh in bulk_update.schedule]
    if len(days) != len(set(days)):
        raise HTTPException(status_code=400, detail="Duplicate days of week in schedule")
    
    for wh in bulk_update.schedule:
        if wh.start_time >= wh.end_time:
            raise HTTPException(status_code=400, detail="Start time must be before end time")

    result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.tenant_id == current_admin.tenant_id)
    )
    existing_whs = {wh.day_of_week: wh for wh in result.scalars().all()}
    
    updated_whs = []
    
    for wh_in in bulk_update.schedule:
        if wh_in.day_of_week in existing_whs:
            wh = existing_whs[wh_in.day_of_week]
            wh.start_time = wh_in.start_time
            wh.end_time = wh_in.end_time
            wh.is_active = wh_in.is_active
            updated_whs.append(wh)
        else:
            new_wh = WorkingHours(
                tenant_id=current_admin.tenant_id,
                day_of_week=wh_in.day_of_week,
                start_time=wh_in.start_time,
                end_time=wh_in.end_time,
                is_active=wh_in.is_active
            )
            db.add(new_wh)
            updated_whs.append(new_wh)
            
    for day, wh in existing_whs.items():
        if day not in days:
            await db.delete(wh)

    await db.flush()
    result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.tenant_id == current_admin.tenant_id)
        .order_by(WorkingHours.day_of_week)
    )
    return result.scalars().all()

@router.get("/users", response_model=List[UserResponse])
async def get_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)]
):
    """
    Fetch all users associated with the admin's tenant.
    """
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_admin.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    tenant_name = tenant.name if tenant else None
    twilio_phone_number = tenant.twilio_phone_number if tenant else None
    result = await db.execute(
        select(User)
        .where(User.tenant_id == current_admin.tenant_id, User.role != UserRole.ADMIN)
    )
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            tenant_id=u.tenant_id,
            is_active=u.is_active,
            twilio_phone_number=twilio_phone_number,
            tenant_name=tenant_name,
        )
        for u in users
    ]

@router.get("/bookings", response_model=List[BookingResponse])
async def get_bookings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_admin: Annotated[User, Depends(get_current_admin)]
):
    """
    Fetch all bookings for the admin's tenant.
    """
    if not current_admin.tenant_id:
        raise HTTPException(status_code=400, detail="Admin has no tenant assigned")
    result = await db.execute(
        select(Booking)
        .where(Booking.tenant_id == current_admin.tenant_id)
        .order_by(Booking.start_time.desc())
    )
    bookings = result.scalars().all()
    if not bookings:
        return []
    service_ids = list({b.service_id for b in bookings})
    svc_result = await db.execute(select(Service).where(Service.id.in_(service_ids)))
    services_map = {s.id: s for s in svc_result.scalars().all()}
    user_ids = {b.user_id for b in bookings if b.user_id is not None}
    users_map: dict[int, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_result.scalars().all()}
    return [
        BookingResponse(
            id=b.id,
            tenant_id=b.tenant_id,
            service_id=b.service_id,
            service_name=(services_map[b.service_id].name if b.service_id in services_map else None),
            service_price=(float(services_map[b.service_id].price) if b.service_id in services_map and services_map[b.service_id].price is not None else None),
            user_id=b.user_id,
            guest_phone=b.guest_phone,
            customer_name=customer_name_from_user(users_map.get(b.user_id)) if b.user_id is not None else None,
            start_time=b.start_time,
            end_time=b.end_time,
            status=b.status,
            source=b.source,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )
        for b in bookings
    ]

