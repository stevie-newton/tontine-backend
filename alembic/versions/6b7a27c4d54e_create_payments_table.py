"""create_payments_table

Revision ID: 6b7a27c4d54e
Revises: 9c99ee851921
Create Date: 2026-03-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6b7a27c4d54e"
down_revision: Union[str, Sequence[str], None] = "9c99ee851921"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("membership_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("contribution_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False, server_default=sa.text("'FLUTTERWAVE'")),
        sa.Column("external_id", sa.String(length=120), nullable=False),
        sa.Column("provider_reference", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["contribution_id"], ["contributions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["membership_id"], ["tontine_memberships.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contribution_id"),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("provider_reference"),
    )
    op.create_index("ix_payments_id", "payments", ["id"], unique=False)
    op.create_index("ix_payments_membership_id", "payments", ["membership_id"], unique=False)
    op.create_index("ix_payments_cycle_id", "payments", ["cycle_id"], unique=False)
    op.create_index("ix_payments_provider", "payments", ["provider"], unique=False)
    op.create_index("ix_payments_status", "payments", ["status"], unique=False)
    op.create_index("ix_payments_cycle_membership", "payments", ["cycle_id", "membership_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payments_cycle_membership", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_provider", table_name="payments")
    op.drop_index("ix_payments_cycle_id", table_name="payments")
    op.drop_index("ix_payments_membership_id", table_name="payments")
    op.drop_index("ix_payments_id", table_name="payments")
    op.drop_table("payments")
