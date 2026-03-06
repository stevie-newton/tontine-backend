"""add rotation_position to tontine memberships

Revision ID: d4a6e9f2c8b1
Revises: c3f4a9b8d1e2
Create Date: 2026-03-04 13:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4a6e9f2c8b1"
down_revision: Union[str, None] = "c3f4a9b8d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tontine_memberships",
        sa.Column("rotation_position", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tontine_memberships", "rotation_position")
