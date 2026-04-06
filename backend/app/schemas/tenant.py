from datetime import datetime

from pydantic import BaseModel


class TenantListResponse(BaseModel):
    id: int
    business: str  # tenant name
    created_at: datetime

    class Config:
        from_attributes = True
