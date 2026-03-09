"""initial_schema

Revision ID: 7cd683648238
Revises: 
Create Date: 2026-02-19 13:49:47.600861

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cd683648238'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    op.create_table(
        "tontines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("contribution_amount", sa.Integer(), nullable=False),
        sa.Column("frequency", sa.String(length=20), nullable=False),
        sa.Column("total_cycles", sa.Integer(), nullable=False),
        sa.Column("current_cycle", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tontines_id", "tontines", ["id"], unique=False)

    op.create_table(
        "tontine_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=True, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        sa.Column("payout_position", sa.Integer(), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tontine_memberships_id", "tontine_memberships", ["id"], unique=False)

    op.create_table(
        "tontine_cycles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("cycle_number", sa.Integer(), nullable=False),
        sa.Column("payout_member_id", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_closed", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["payout_member_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tontine_cycles_id", "tontine_cycles", ["id"], unique=False)

    op.create_table(
        "contributions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("membership_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["membership_id"], ["tontine_memberships.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("membership_id", "cycle_id", name="uq_contributions_membership_cycle"),
    )
    op.create_index("ix_contributions_id", "contributions", ["id"], unique=False)
    op.create_index("ix_contributions_membership_id", "contributions", ["membership_id"], unique=False)
    op.create_index("ix_contributions_cycle_id", "contributions", ["cycle_id"], unique=False)

    op.create_table(
        "payouts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=False),
        sa.Column("membership_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("is_processed", sa.Boolean(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"]),
        sa.ForeignKeyConstraint(["membership_id"], ["tontine_memberships.id"]),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payouts_id", "payouts", ["id"], unique=False)

    op.create_table(
        "transaction_ledgers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tontine_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=True),
        sa.Column("membership_id", sa.Integer(), nullable=True),
        sa.Column("contribution_id", sa.Integer(), nullable=True),
        sa.Column("payout_id", sa.Integer(), nullable=True),
        sa.Column("entry_type", sa.String(length=20), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["contribution_id"], ["contributions.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["tontine_cycles.id"]),
        sa.ForeignKeyConstraint(["membership_id"], ["tontine_memberships.id"]),
        sa.ForeignKeyConstraint(["payout_id"], ["payouts.id"]),
        sa.ForeignKeyConstraint(["tontine_id"], ["tontines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transaction_ledgers_id", "transaction_ledgers", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_transaction_ledgers_id", table_name="transaction_ledgers")
    op.drop_table("transaction_ledgers")
    op.drop_index("ix_payouts_id", table_name="payouts")
    op.drop_table("payouts")
    op.drop_index("ix_contributions_cycle_id", table_name="contributions")
    op.drop_index("ix_contributions_membership_id", table_name="contributions")
    op.drop_index("ix_contributions_id", table_name="contributions")
    op.drop_table("contributions")
    op.drop_index("ix_tontine_cycles_id", table_name="tontine_cycles")
    op.drop_table("tontine_cycles")
    op.drop_index("ix_tontine_memberships_id", table_name="tontine_memberships")
    op.drop_table("tontine_memberships")
    op.drop_index("ix_tontines_id", table_name="tontines")
    op.drop_table("tontines")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
