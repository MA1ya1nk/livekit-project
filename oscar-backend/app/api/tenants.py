from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.models.service import Service
from app.schemas.tenant import TenantListResponse
from app.schemas.service import ServiceResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantListResponse])
async def list_tenants(db: Annotated[AsyncSession, Depends(get_db)]):
    """List tenants for signup dropdown; only active tenants are shown."""
    result = await db.execute(
        select(Tenant).where(Tenant.is_active == True).order_by(Tenant.created_at.desc())
    )
    tenants = result.scalars().all()
    return [
        TenantListResponse(id=t.id, business=t.name, created_at=t.created_at)
        for t in tenants
    ]


@router.get("/{tenant_id}/services", response_model=List[ServiceResponse])
async def list_tenant_services(
    tenant_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List services for a tenant (e.g. for user to pick when booking). Only active tenants."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active == True)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    svc_result = await db.execute(
        select(Service).where(Service.tenant_id == tenant_id).order_by(Service.id)
    )
    return svc_result.scalars().all()
