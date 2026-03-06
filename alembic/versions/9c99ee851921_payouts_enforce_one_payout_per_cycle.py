"""payouts: enforce one payout per cycle

Revision ID: 9c99ee851921
Revises: 2f4d9d2e6a11
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c99ee851921"
down_revision: Union[str, Sequence[str], None] = "2f4d9d2e6a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Unique: only one payout per cycle
    op.create_unique_constraint(
        "uq_payouts_cycle_id",
        "payouts",
        ["cycle_id"],
    )

    # 2) Optional but useful: speed up lookups by tontine/cycle and by membership
    op.create_index(
        "ix_payouts_tontine_cycle",
        "payouts",
        ["tontine_id", "cycle_id"],
        unique=False,
    )
    op.create_index(
        "ix_payouts_membership_id",
        "payouts",
        ["membership_id"],
        unique=False,
    )

    # 3) Optional hardening: default false (and ensure not null)
    # If you already have is_processed nullable=False in DB, you can remove existing_nullable.
    op.alter_column(
        "payouts",
        "is_processed",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        existing_nullable=True,
    )
    # If you want to enforce NOT NULL at DB level, uncomment:
    # op.execute("UPDATE payouts SET is_processed = false WHERE is_processed IS NULL;")
    # op.alter_column("payouts", "is_processed", existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    # Reverse order
    op.alter_column(
        "payouts",
        "is_processed",
        existing_type=sa.Boolean(),
        server_default=None,
        existing_nullable=True,
    )

    op.drop_index("ix_payouts_membership_id", table_name="payouts")
    op.drop_index("ix_payouts_tontine_cycle", table_name="payouts")
    op.drop_constraint("uq_payouts_cycle_id", "payouts", type_="unique")
