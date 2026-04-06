"""add_service_fields_for_limits_and_metadata

Revision ID: b7f0d5c92b31
Revises: 0caada5e0db2
Create Date: 2026-03-19 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7f0d5c92b31"
down_revision: Union[str, Sequence[str], None] = "0caada5e0db2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("services", sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column(
        "services",
        sa.Column("max_bookings_per_user_per_day", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column("services", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_services_created_by"), "services", ["created_by"], unique=False)
    op.create_foreign_key("fk_services_created_by_users", "services", "users", ["created_by"], ["id"])

    op.alter_column("services", "price", server_default=None)
    op.alter_column("services", "max_bookings_per_user_per_day", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_services_created_by_users", "services", type_="foreignkey")
    op.drop_index(op.f("ix_services_created_by"), table_name="services")
    op.drop_column("services", "created_by")
    op.drop_column("services", "max_bookings_per_user_per_day")
    op.drop_column("services", "price")
    op.drop_column("services", "description")
