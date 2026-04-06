import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class NumberRequestStatus(str, enum.Enum):
    REQUESTED = "requested"
    ASSIGNED = "assigned"
    REJECTED = "rejected"


class NumberRequest(Base):
    """
    Admin requests a Twilio number; Super Admin assigns it.
    One tenant can have multiple requests over time; only the latest requested/pending matters for "pending" list.
    """
    __tablename__ = "number_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    status: Mapped[NumberRequestStatus] = mapped_column(Enum(NumberRequestStatus), nullable=False, default=NumberRequestStatus.REQUESTED)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    twilio_phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    twilio_phone_number_sid: Mapped[str | None] = mapped_column(String(50), nullable=True)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="number_requests")
