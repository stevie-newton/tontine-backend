from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class TransactionLedger(Base):
    __tablename__ = "transaction_ledgers"

    id = Column(Integer, primary_key=True, index=True)

    tontine_id = Column(Integer, ForeignKey("tontines.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("tontine_cycles.id"), nullable=True)
    membership_id = Column(Integer, ForeignKey("tontine_memberships.id"), nullable=True)

    contribution_id = Column(Integer, ForeignKey("contributions.id"), nullable=True)
    payout_id = Column(Integer, ForeignKey("payouts.id"), nullable=True)

    entry_type = Column(String(20), nullable=False)  # contribution | payout | adjustment
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tontine = relationship("Tontine")
    cycle = relationship("TontineCycle")
    membership = relationship("TontineMembership")
    contribution = relationship("Contribution")
    payout = relationship("Payout")
