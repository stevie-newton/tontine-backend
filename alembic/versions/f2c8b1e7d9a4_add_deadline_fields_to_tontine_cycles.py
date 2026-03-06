"""add deadline fields to tontine cycles

Revision ID: f2c8b1e7d9a4
Revises: e1b7c2d9f4a3
Create Date: 2026-03-04 18:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2c8b1e7d9a4"
down_revision: Union[str, None] = "e1b7c2d9f4a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tontine_cycles",
        sa.Column("contribution_deadline", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tontine_cycles",
        sa.Column(
            "grace_period_hours",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.execute("UPDATE tontine_cycles SET contribution_deadline = end_date WHERE contribution_deadline IS NULL")


def downgrade() -> None:
    op.drop_column("tontine_cycles", "grace_period_hours")
    op.drop_column("tontine_cycles", "contribution_deadline")
