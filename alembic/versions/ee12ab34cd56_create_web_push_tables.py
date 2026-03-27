"""create web push tables

Revision ID: ee12ab34cd56
Revises: d1a7b5c9e2f4
Create Date: 2026-03-13 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ee12ab34cd56"
down_revision: Union[str, None] = "d1a7b5c9e2f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.String(length=1000), nullable=False),
        sa.Column("p256dh", sa.String(length=255), nullable=False),
        sa.Column("auth", sa.String(length=255), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),
    )
    op.create_index(
        "ix_push_subscriptions_user_active",
        "push_subscriptions",
        ["user_id", "is_active"],
        unique=False,
    )

    op.create_table(
        "push_notification_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "user_id",
            "cycle_id",
            "kind",
            name="uq_push_notification_logs_user_cycle_kind",
        ),
    )
    op.create_index(
        "ix_push_notification_logs_cycle_kind",
        "push_notification_logs",
        ["cycle_id", "kind"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_push_notification_logs_cycle_kind", table_name="push_notification_logs")
    op.drop_table("push_notification_logs")
    op.drop_index("ix_push_subscriptions_user_active", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")

