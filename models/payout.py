from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, UniqueConstraint, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("tontine_cycles.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("tontine_memberships.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cycle = relationship("TontineCycle")
    membership = relationship("TontineMembership")

    __table_args__ = (
        UniqueConstraint("cycle_id", name="uq_payout_cycle"),
    )
