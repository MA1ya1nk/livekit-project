from datetime import datetime, timezone, time
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Integer, Numeric, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.booking import Booking


# Allowed slot durations in minutes (admin picks one per service)
ALLOWED_SLOT_DURATIONS = [15, 30, 60]


class Service(Base):
    """
    A service offered by a tenant (e.g. Dental, Skin). Each has one slot duration (15/30/60 min).
    Bookings are always for a service.
    """
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    managed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    max_bookings_per_user_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    available_from_time: Mapped[time] = mapped_column(Time, nullable=False)
    available_to_time: Mapped[time] = mapped_column(Time, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Explicitly bind to Service.tenant_id (tenants.default_service_id also points to services.id,
    # which would otherwise make the relationship join ambiguous).
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="services",
        foreign_keys=[tenant_id],
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="service")

    def __repr__(self) -> str:
        return f"<Service id={self.id} name={self.name} slot_duration={self.slot_duration_minutes}>"
