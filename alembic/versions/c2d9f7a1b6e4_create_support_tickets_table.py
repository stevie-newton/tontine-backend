"""create support tickets table

Revision ID: c2d9f7a1b6e4
Revises: b8a1c9d2e4f7
Create Date: 2026-03-05 14:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d9f7a1b6e4"
down_revision: Union[str, None] = "b8a1c9d2e4f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("screenshot_url", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_tickets_id", "support_tickets", ["id"], unique=False)
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"], unique=False)
    op.create_index("ix_support_tickets_tontine_id", "support_tickets", ["tontine_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_support_tickets_tontine_id", table_name="support_tickets")
    op.drop_index("ix_support_tickets_user_id", table_name="support_tickets")
    op.drop_index("ix_support_tickets_id", table_name="support_tickets")
    op.drop_table("support_tickets")
