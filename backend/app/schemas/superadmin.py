from datetime import datetime

from pydantic import BaseModel


class AdminListItem(BaseModel):
    """Admin with tenant name for super admin list."""
    id: int
    email: str
    full_name: str | None
    tenant_id: int | None
    tenant_name: str | None
    is_active: bool
    tenant_is_active: bool

    class Config:
        from_attributes = True


class NumberRequestListItem(BaseModel):
    """Number request for super admin pending list."""
    id: int
    tenant_id: int
    tenant_name: str
    status: str
    requested_at: datetime

    class Config:
        from_attributes = True


class AssignNumberBody(BaseModel):
    """Body when super admin assigns a number to a request."""
    phone_number: str
