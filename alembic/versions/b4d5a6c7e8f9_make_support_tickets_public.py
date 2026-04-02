"""make support tickets public

Revision ID: b4d5a6c7e8f9
Revises: a2f6c7d8e9b1
Create Date: 2026-04-02 11:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4d5a6c7e8f9"
down_revision: Union[str, None] = "a2f6c7d8e9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("support_tickets", "user_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("support_tickets", sa.Column("requester_name", sa.String(length=100), nullable=True))
    op.add_column("support_tickets", sa.Column("requester_phone", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("support_tickets", "requester_phone")
    op.drop_column("support_tickets", "requester_name")
    op.alter_column("support_tickets", "user_id", existing_type=sa.Integer(), nullable=False)
