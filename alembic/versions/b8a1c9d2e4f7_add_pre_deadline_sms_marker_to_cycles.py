"""add pre-deadline sms marker to tontine cycles

Revision ID: b8a1c9d2e4f7
Revises: a9d3b7e4c1f2
Create Date: 2026-03-05 10:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8a1c9d2e4f7"
down_revision: Union[str, None] = "a9d3b7e4c1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tontine_cycles",
        sa.Column("pre_deadline_sms_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tontine_cycles", "pre_deadline_sms_sent_at")
