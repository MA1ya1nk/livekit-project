from datetime import time
from typing import List
from pydantic import BaseModel, Field

class WorkingHoursBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    is_active: bool = True

class WorkingHoursCreate(WorkingHoursBase):
    pass

class WorkingHoursUpdate(WorkingHoursBase):
    pass

class WorkingHoursResponse(WorkingHoursBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True

class WorkingHoursBulkUpdate(BaseModel):
    schedule: List[WorkingHoursUpdate]
