"""add preferred language to users

Revision ID: d7f3b1a9c4e2
Revises: c6d4e8f1a9b2
Create Date: 2026-04-05 00:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7f3b1a9c4e2"
down_revision: Union[str, None] = "c6d4e8f1a9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_language", sa.String(length=5), nullable=False, server_default=sa.text("'en'")),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
