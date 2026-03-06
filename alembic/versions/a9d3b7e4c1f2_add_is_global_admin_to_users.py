"""add is_global_admin to users

Revision ID: a9d3b7e4c1f2
Revises: f2c8b1e7d9a4
Create Date: 2026-03-05 14:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9d3b7e4c1f2"
down_revision: Union[str, None] = "f2c8b1e7d9a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_global_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "is_global_admin")
