"""add last_sent_at to registration otps

Revision ID: a7e2d1c4b9f6
Revises: f5a4c8d1e2b9
Create Date: 2026-03-05 16:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7e2d1c4b9f6"
down_revision: Union[str, None] = "f5a4c8d1e2b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("registration_otps", sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("registration_otps", "last_sent_at")
