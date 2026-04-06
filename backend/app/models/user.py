import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.booking import Booking


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"


class User(Base):
    """
    Account that can log in. Either Admin (business owner) or User (customer).
    Admin has one Tenant; User belongs to one Tenant (the business they book with).
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=lambda: datetime.now(timezone.utc))
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True, index=True)
    default_service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="users")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role.value}>"
