"""add_password_reset_fields_to_users

Revision ID: b1d4d2d0d81e
Revises: 6b7a27c4d54e
Create Date: 2026-03-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1d4d2d0d81e"
down_revision: Union[str, Sequence[str], None] = "6b7a27c4d54e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_reset_code_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("password_reset_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("users", sa.Column("password_reset_requested_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_reset_requested_at")
    op.drop_column("users", "password_reset_attempts")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_code_hash")
