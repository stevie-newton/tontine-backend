from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, UniqueConstraint, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    tontine_id = Column(Integer, ForeignKey("tontines.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("tontine_cycles.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("tontine_memberships.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    is_processed = Column(Boolean, nullable=False, server_default="false")
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tontine = relationship("Tontine")
    cycle = relationship("TontineCycle")
    membership = relationship("TontineMembership")

    __table_args__ = (
        UniqueConstraint("cycle_id", name="uq_payout_cycle"),
    )

    @property
    def is_paid(self):
        return self.is_processed

    @is_paid.setter
    def is_paid(self, value):
        self.is_processed = value

    @property
    def paid_at(self):
        return self.processed_at

    @paid_at.setter
    def paid_at(self, value):
        self.processed_at = value
