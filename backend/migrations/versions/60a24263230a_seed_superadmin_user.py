"""seed_superadmin_user

Revision ID: 60a24263230a
Revises: 30d8bd576471
Create Date: 2026-03-12 12:10:14.297547

"""
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60a24263230a'
down_revision: Union[str, Sequence[str], None] = '30d8bd576471'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Insert super_admin user from .env (SUPER_ADMIN enum value is added in 30d8bd576471)."""
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    email = os.environ.get("SUPERADMIN_EMAIL", "").strip()
    password = os.environ.get("SUPERADMIN_PASSWORD", "")
    if not email or not password:
        return
    from app.core.security import hash_password
    email_lower = email.lower()
    exists = conn.execute(
        sa.text("SELECT 1 FROM users WHERE email = :email AND role = 'SUPER_ADMIN'"),
        {"email": email_lower},
    ).fetchone()
    if exists:
        return
    hashed = hash_password(password)
    conn.execute(
        sa.text(
            "INSERT INTO users (email, hashed_password, role, is_active, created_at, updated_at) "
            "VALUES (:email, :hashed, 'SUPER_ADMIN', true, NOW(), NOW())"
        ),
        {"email": email_lower, "hashed": hashed},
    )


def downgrade() -> None:
    """Remove super_admin user (by SUPERADMIN_EMAIL from env)."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    email = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()
    if email:
        op.get_bind().execute(
            sa.text("DELETE FROM users WHERE email = :email AND role = 'SUPER_ADMIN'"),
            {"email": email},
        )
