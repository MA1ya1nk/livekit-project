import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.voice_call import VoiceCall
    from app.models.service import Service


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class BookingSource(str, enum.Enum):
    MANUAL = "manual"
    VOICE = "voice"


class Booking(Base):
    """
    Represents a scheduled appointment.
    """
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True, nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    guest_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.CONFIRMED, nullable=False)
    source: Mapped[BookingSource] = mapped_column(Enum(BookingSource), default=BookingSource.MANUAL, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="bookings")
    service: Mapped["Service"] = relationship("Service", back_populates="bookings")
    user: Mapped["User | None"] = relationship("User", back_populates="bookings")
    voice_call: Mapped["VoiceCall | None"] = relationship("VoiceCall", back_populates="booking", uselist=False)

    def __repr__(self) -> str:
        return f"<Booking id={self.id} start={self.start_time} end={self.end_time} status={self.status.value}>"
