"""add_service_managed_by

Revision ID: d9c1a7e13f42
Revises: c2f91d7e8a4b
Create Date: 2026-03-19 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d9c1a7e13f42"
down_revision: Union[str, Sequence[str], None] = "c2f91d7e8a4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("managed_by", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("services", "managed_by")
