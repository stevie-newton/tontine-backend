"""create registration otps table

Revision ID: f5a4c8d1e2b9
Revises: c2d9f7a1b6e4
Create Date: 2026-03-05 16:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f5a4c8d1e2b9"
down_revision: Union[str, None] = "c2d9f7a1b6e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "registration_otps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_registration_otps_id", "registration_otps", ["id"], unique=False)
    op.create_index("ix_registration_otps_phone", "registration_otps", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_registration_otps_phone", table_name="registration_otps")
    op.drop_index("ix_registration_otps_id", table_name="registration_otps")
    op.drop_table("registration_otps")
