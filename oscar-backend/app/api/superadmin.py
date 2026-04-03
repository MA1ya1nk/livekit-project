from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.number_request import NumberRequest, NumberRequestStatus
from app.api.deps import get_current_super_admin
from app.schemas.superadmin import AdminListItem, NumberRequestListItem, AssignNumberBody
from app.core.twilio_client import find_incoming_phone_number, set_voice_url, get_voice_webhook_url, normalize_phone_for_twilio
from app.config import settings
from datetime import datetime, timezone

router = APIRouter(tags=["superadmin"])


@router.get("/admins", response_model=List[AdminListItem])
async def list_admins(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_super_admin)],
    status_filter: Annotated[str | None, Query(description="Filter by active or inactive")] = None,
):
    """
    List all admins with tenant name. Use ?status=active or ?status=inactive to filter.
    Active = admin and tenant both active; inactive = either is inactive.
    """
    q = select(User).where(User.role == UserRole.ADMIN).order_by(User.id)
    result = await db.execute(q)
    admins = result.scalars().all()
    # Load tenants for names and is_active
    tenant_ids = [a.tenant_id for a in admins if a.tenant_id]
    tenants_map = {}
    if tenant_ids:
        t_result = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
        for t in t_result.scalars().all():
            tenants_map[t.id] = t
    out = []
    for a in admins:
        tenant = tenants_map.get(a.tenant_id) if a.tenant_id else None
        tenant_name = tenant.name if tenant else None
        tenant_is_active = tenant.is_active if tenant else False
        is_active = a.is_active
        if status_filter == "active":
            if not is_active or not tenant_is_active:
                continue
        elif status_filter == "inactive":
            if is_active and tenant_is_active:
                continue
        out.append(
            AdminListItem(
                id=a.id,
                email=a.email,
                full_name=a.full_name,
                tenant_id=a.tenant_id,
                tenant_name=tenant_name,
                is_active=is_active,
                tenant_is_active=tenant_is_active,
            )
        )
    return out


@router.post("/admins/{admin_id}/deactivate")
async def deactivate_admin(
    admin_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_super_admin)],
):
    """Deactivate an admin and their tenant. They and their users will see deactivated message on login."""
    result = await db.execute(select(User).where(User.id == admin_id, User.role == UserRole.ADMIN))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if not admin.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin has no tenant")
    admin.is_active = False
    result = await db.execute(select(Tenant).where(Tenant.id == admin.tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant:
        tenant.is_active = False
    await db.commit()
    return {"message": "Admin and tenant deactivated"}


@router.post("/admins/{admin_id}/activate")
async def activate_admin(
    admin_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_super_admin)],
):
    """Reactivate an admin and their tenant."""
    result = await db.execute(select(User).where(User.id == admin_id, User.role == UserRole.ADMIN))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if not admin.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin has no tenant")
    admin.is_active = True
    result = await db.execute(select(Tenant).where(Tenant.id == admin.tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant:
        tenant.is_active = True
    await db.commit()
    return {"message": "Admin and tenant activated"}


@router.get("/number-requests", response_model=List[NumberRequestListItem])
async def list_number_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_super_admin)],
    status_filter: Annotated[str | None, Query(description="requested (pending), assigned, or rejected")] = "requested",
):
    """List number requests. Default: pending (status=requested)."""
    try:
        status_enum = NumberRequestStatus(status_filter) if status_filter else NumberRequestStatus.REQUESTED
    except ValueError:
        status_enum = NumberRequestStatus.REQUESTED
    result = await db.execute(
        select(NumberRequest)
        .where(NumberRequest.status == status_enum)
        .order_by(NumberRequest.requested_at.desc())
    )
    requests = result.scalars().all()
    tenant_ids = [r.tenant_id for r in requests]
    tenants_map = {}
    if tenant_ids:
        t_result = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
        for t in t_result.scalars().all():
            tenants_map[t.id] = t
    return [
        NumberRequestListItem(
            id=r.id,
            tenant_id=r.tenant_id,
            tenant_name=tenants_map[r.tenant_id].name if r.tenant_id in tenants_map else "",
            status=r.status.value,
            requested_at=r.requested_at,
        )
        for r in requests
    ]


@router.post("/number-requests/{request_id}/assign")
async def assign_number_to_request(
    request_id: int,
    body: AssignNumberBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_super_admin)],
):
    """Assign a Twilio number to a pending number request. Validates number is in Twilio account and sets voice webhook."""
    result = await db.execute(
        select(NumberRequest).where(NumberRequest.id == request_id, NumberRequest.status == NumberRequestStatus.REQUESTED)
    )
    num_req = result.scalar_one_or_none()
    if not num_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending number request not found")
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twilio is not configured.",
        )
    info = find_incoming_phone_number(body.phone_number)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This phone number is not in your Twilio account. Add it in Twilio Console first.",
        )
    voice_url = get_voice_webhook_url()
    status_url = get_voice_webhook_url("/api/voice/status")
    if not set_voice_url(info["sid"], voice_url, status_callback_url=status_url):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to set Voice URL on Twilio.")
    # Update tenant with number
    t_result = await db.execute(select(Tenant).where(Tenant.id == num_req.tenant_id))
    tenant = t_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    tenant.twilio_phone_number = normalize_phone_for_twilio(info["phone_number"])
    tenant.twilio_phone_number_sid = info["sid"]
    num_req.status = NumberRequestStatus.ASSIGNED
    num_req.assigned_at = datetime.now(timezone.utc)
    num_req.twilio_phone_number = tenant.twilio_phone_number
    num_req.twilio_phone_number_sid = info["sid"]
    await db.commit()
    return {"message": "Number assigned", "phone_number": tenant.twilio_phone_number}
