"""add_user_default_service_id

Revision ID: c4e3f2a1b0c7
Revises: d9c1a7e13f42
Create Date: 2026-03-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4e3f2a1b0c7"
down_revision: Union[str, Sequence[str], None] = "d9c1a7e13f42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_service_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_default_service_id"), "users", ["default_service_id"], unique=False)
    op.create_foreign_key(
        "fk_users_default_service_id_services",
        "users",
        "services",
        ["default_service_id"],
        ["id"],
        ondelete=None,
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_default_service_id_services", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_default_service_id"), table_name="users")
    op.drop_column("users", "default_service_id")

