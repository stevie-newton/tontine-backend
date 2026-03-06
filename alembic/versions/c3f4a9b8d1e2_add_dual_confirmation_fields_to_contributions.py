"""add dual confirmation fields to contributions

Revision ID: c3f4a9b8d1e2
Revises: b1d4d2d0d81e
Create Date: 2026-03-04 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3f4a9b8d1e2"
down_revision: Union[str, None] = "b1d4d2d0d81e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "contributions",
        sa.Column("transaction_reference", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "contributions",
        sa.Column("proof_screenshot_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "contributions",
        sa.Column(
            "beneficiary_decision",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "contributions",
        sa.Column("confirmed_by_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "contributions",
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contributions",
        sa.Column(
            "ledger_entry_created",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_foreign_key(
        "fk_contributions_confirmed_by_user_id_users",
        "contributions",
        "users",
        ["confirmed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("UPDATE contributions SET transaction_reference = 'legacy-' || id WHERE transaction_reference IS NULL")
    op.alter_column("contributions", "transaction_reference", nullable=False)
    op.alter_column(
        "contributions",
        "is_confirmed",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column(
        "contributions",
        "is_confirmed",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("true"),
    )
    op.drop_constraint("fk_contributions_confirmed_by_user_id_users", "contributions", type_="foreignkey")
    op.drop_column("contributions", "ledger_entry_created")
    op.drop_column("contributions", "confirmed_at")
    op.drop_column("contributions", "confirmed_by_user_id")
    op.drop_column("contributions", "beneficiary_decision")
    op.drop_column("contributions", "proof_screenshot_url")
    op.drop_column("contributions", "transaction_reference")
