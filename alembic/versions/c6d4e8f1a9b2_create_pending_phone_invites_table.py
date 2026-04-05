"""create pending phone invites table

Revision ID: c6d4e8f1a9b2
Revises: b4d5a6c7e8f9
Create Date: 2026-04-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6d4e8f1a9b2"
down_revision: Union[str, None] = "b4d5a6c7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pending_phone_invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default=sa.text("'member'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("phone", "tontine_id", name="uq_pending_phone_invites_phone_tontine"),
    )
    op.create_index("ix_pending_phone_invites_phone", "pending_phone_invites", ["phone"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_pending_phone_invites_phone", table_name="pending_phone_invites")
    op.drop_table("pending_phone_invites")
