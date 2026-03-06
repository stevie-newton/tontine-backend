"""add is_phone_verified to users

Revision ID: d1a7b5c9e2f4
Revises: a7e2d1c4b9f6
Create Date: 2026-03-05 17:25:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1a7b5c9e2f4"
down_revision: Union[str, None] = "a7e2d1c4b9f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_phone_verified", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("users", "is_phone_verified")
