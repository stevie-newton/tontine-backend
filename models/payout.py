from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    Boolean,
    Numeric,
    UniqueConstraint,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)

    tontine_id = Column(
        Integer,
        ForeignKey("tontines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    cycle_id = Column(
        Integer,
        ForeignKey("tontine_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    membership_id = Column(
        Integer,
        ForeignKey("tontine_memberships.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Money: match Contribution.amount
    amount = Column(Numeric(12, 2), nullable=False)

    is_processed = Column(Boolean, nullable=False, server_default="false")

    processed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships (use back_populates if you add the other side)
    tontine = relationship("Tontine", back_populates="payouts")
    cycle = relationship("TontineCycle", back_populates="payout")
    membership = relationship("TontineMembership", back_populates="payouts")

    __table_args__ = (
        # ✅ Fixture: only one payout per cycle
        UniqueConstraint("cycle_id", name="uq_payouts_cycle_id"),

        # Optional: if you prefer scoping uniqueness by tontine too
        # UniqueConstraint("tontine_id", "cycle_id", name="uq_payouts_tontine_cycle"),

        Index("ix_payouts_tontine_cycle", "tontine_id", "cycle_id"),
    )