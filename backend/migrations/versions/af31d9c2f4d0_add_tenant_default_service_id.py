"""add_tenant_default_service_id

Revision ID: af31d9c2f4d0
Revises: c4e3f2a1b0c7
Create Date: 2026-03-20 00:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "af31d9c2f4d0"
down_revision: Union[str, Sequence[str], None] = "c4e3f2a1b0c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("default_service_id", sa.Integer(), nullable=True),
    )
    op.create_index(op.f("ix_tenants_default_service_id"), "tenants", ["default_service_id"], unique=False)
    op.create_foreign_key(
        "fk_tenants_default_service_id_services",
        "tenants",
        "services",
        ["default_service_id"],
        ["id"],
        ondelete=None,
    )


def downgrade() -> None:
    op.drop_constraint("fk_tenants_default_service_id_services", "tenants", type_="foreignkey")
    op.drop_index(op.f("ix_tenants_default_service_id"), table_name="tenants")
    op.drop_column("tenants", "default_service_id")

