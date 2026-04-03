"""add_service_available_hours

Revision ID: c2f91d7e8a4b
Revises: b7f0d5c92b31
Create Date: 2026-03-19 16:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2f91d7e8a4b"
down_revision: Union[str, Sequence[str], None] = "b7f0d5c92b31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("available_from_time", sa.Time(), nullable=False, server_default="00:00:00"),
    )
    op.add_column(
        "services",
        sa.Column("available_to_time", sa.Time(), nullable=False, server_default="23:59:00"),
    )
    op.alter_column("services", "available_from_time", server_default=None)
    op.alter_column("services", "available_to_time", server_default=None)


def downgrade() -> None:
    op.drop_column("services", "available_to_time")
    op.drop_column("services", "available_from_time")
