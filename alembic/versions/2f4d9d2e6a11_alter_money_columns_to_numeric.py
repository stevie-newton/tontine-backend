"""alter_money_columns_to_numeric

Revision ID: 2f4d9d2e6a11
Revises: 7cd683648238
Create Date: 2026-02-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2f4d9d2e6a11"
down_revision: Union[str, Sequence[str], None] = "7cd683648238"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "tontines",
        "contribution_amount",
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "contributions",
        "amount",
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "payouts",
        "amount",
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )
    op.alter_column(
        "transaction_ledgers",
        "amount",
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "transaction_ledgers",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="amount::integer",
    )
    op.alter_column(
        "payouts",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="amount::integer",
    )
    op.alter_column(
        "contributions",
        "amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="amount::integer",
    )
    op.alter_column(
        "tontines",
        "contribution_amount",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="contribution_amount::integer",
    )
