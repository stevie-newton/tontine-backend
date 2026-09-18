"""Add a private object storage key for contribution screenshots.

Revision ID: e4b9a1d7c2f6
Revises: d7f3b1a9c4e2
"""
from alembic import op
import sqlalchemy as sa

revision = "e4b9a1d7c2f6"
down_revision = "d7f3b1a9c4e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contributions", sa.Column("proof_storage_key", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("contributions", "proof_storage_key")
