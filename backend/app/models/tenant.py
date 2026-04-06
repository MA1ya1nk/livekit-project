from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.working_hours import WorkingHours
    from app.models.booking import Booking
    from app.models.voice_call import VoiceCall
    from app.models.number_request import NumberRequest
    from app.models.service import Service


class Tenant(Base):
    """
    The business. One per Admin. All Users (customers) belong to a tenant.
    """
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    slug: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    # Default service that is pre-selected on the customer booking page.
    default_service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    twilio_phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    twilio_phone_number_sid: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    users: Mapped[list["User"]] = relationship("User", back_populates="tenant", lazy="selectin")
    working_hours: Mapped[list["WorkingHours"]] = relationship("WorkingHours", back_populates="tenant", lazy="selectin")
    # Explicitly bind to Service.tenant_id, since Tenant.default_service_id is also an FK to services.id
    # which would otherwise make the join ambiguous.
    services: Mapped[list["Service"]] = relationship(
        "Service",
        back_populates="tenant",
        lazy="selectin",
        foreign_keys="Service.tenant_id",
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="tenant", lazy="selectin")
    voice_calls: Mapped[list["VoiceCall"]] = relationship("VoiceCall", back_populates="tenant", lazy="selectin")
    number_requests: Mapped[list["NumberRequest"]] = relationship("NumberRequest", back_populates="tenant", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} name={self.name}>"
