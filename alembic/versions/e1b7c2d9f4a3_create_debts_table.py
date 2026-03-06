"""create debts table

Revision ID: e1b7c2d9f4a3
Revises: d4a6e9f2c8b1
Create Date: 2026-03-04 16:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1b7c2d9f4a3"
down_revision: Union[str, None] = "d4a6e9f2c8b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "debts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("debtor_membership_id", sa.Integer(), nullable=False),
        sa.Column("coverer_membership_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_repaid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("repaid_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["coverer_membership_id"], ["tontine_memberships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["debtor_membership_id"], ["tontine_memberships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cycle_id", "debtor_membership_id", name="uq_debts_cycle_debtor"),
    )
    op.create_index(op.f("ix_debts_tontine_id"), "debts", ["tontine_id"], unique=False)
    op.create_index(op.f("ix_debts_cycle_id"), "debts", ["cycle_id"], unique=False)
    op.create_index(op.f("ix_debts_debtor_membership_id"), "debts", ["debtor_membership_id"], unique=False)
    op.create_index(op.f("ix_debts_coverer_membership_id"), "debts", ["coverer_membership_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_debts_coverer_membership_id"), table_name="debts")
    op.drop_index(op.f("ix_debts_debtor_membership_id"), table_name="debts")
    op.drop_index(op.f("ix_debts_cycle_id"), table_name="debts")
    op.drop_index(op.f("ix_debts_tontine_id"), table_name="debts")
    op.drop_table("debts")
