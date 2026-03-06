from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, Numeric, String, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    tontine_id = Column(Integer, ForeignKey("tontines.id", ondelete="CASCADE"), nullable=False, index=True)
    cycle_id = Column(Integer, ForeignKey("tontine_cycles.id", ondelete="CASCADE"), nullable=False, index=True)

    debtor_membership_id = Column(
        Integer,
        ForeignKey("tontine_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coverer_membership_id = Column(
        Integer,
        ForeignKey("tontine_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    amount = Column(Numeric(12, 2), nullable=False)
    is_repaid = Column(Boolean, nullable=False, server_default="false")
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    repaid_at = Column(DateTime(timezone=True), nullable=True)

    tontine = relationship("Tontine")
    cycle = relationship("TontineCycle")
    debtor_membership = relationship("TontineMembership", foreign_keys=[debtor_membership_id])
    coverer_membership = relationship("TontineMembership", foreign_keys=[coverer_membership_id])

    __table_args__ = (
        UniqueConstraint("cycle_id", "debtor_membership_id", name="uq_debts_cycle_debtor"),
    )
