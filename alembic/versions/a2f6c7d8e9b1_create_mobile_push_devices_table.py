"""create mobile push devices table

Revision ID: a2f6c7d8e9b1
Revises: ee12ab34cd56
Create Date: 2026-03-16 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a2f6c7d8e9b1"
down_revision: Union[str, None] = "ee12ab34cd56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mobile_push_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expo_push_token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("device_name", sa.String(length=255), nullable=True),
        sa.Column("app_version", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("expo_push_token", name="uq_mobile_push_devices_expo_push_token"),
    )
    op.create_index(
        "ix_mobile_push_devices_user_active",
        "mobile_push_devices",
        ["user_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_mobile_push_devices_user_active", table_name="mobile_push_devices")
    op.drop_table("mobile_push_devices")
