from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    Boolean,
    String,
    UniqueConstraint,
    Numeric,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True, index=True)

    membership_id = Column(
        Integer,
        ForeignKey("tontine_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    cycle_id = Column(
        Integer,
        ForeignKey("tontine_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    amount = Column(Numeric(12, 2), nullable=False)

    transaction_reference = Column(String(120), nullable=False)
    proof_screenshot_url = Column(String(500), nullable=True)

    # Dual confirmation workflow: pending -> confirmed/rejected
    beneficiary_decision = Column(String(20), nullable=False, server_default="pending")
    confirmed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    is_confirmed = Column(Boolean, nullable=False, server_default="false")
    ledger_entry_created = Column(Boolean, nullable=False, server_default="false")

    paid_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    membership = relationship("TontineMembership", back_populates="contributions")
    cycle = relationship("TontineCycle", back_populates="contributions")

    __table_args__ = (
        UniqueConstraint(
            "membership_id",
            "cycle_id",
            name="uq_contributions_membership_cycle",
        ),
        # Optional: explicit indexes (helpful on large tables)
        Index("ix_contributions_cycle_membership", "cycle_id", "membership_id"),
    )
