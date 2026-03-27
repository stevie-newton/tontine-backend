from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class TontineCycle(Base):
    __tablename__ = "tontine_cycles"

    id = Column(Integer, primary_key=True, index=True)
    tontine_id = Column(Integer, ForeignKey("tontines.id"), nullable=False)
    cycle_number = Column(Integer, nullable=False)
    payout_member_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    contribution_deadline = Column(DateTime(timezone=True), nullable=True)
    grace_period_hours = Column(Integer, nullable=False, server_default="0")
    pre_deadline_sms_sent_at = Column(DateTime(timezone=True), nullable=True)
    is_closed = Column(Boolean, default=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tontine = relationship("Tontine")
    payout_member = relationship("User")
    contributions = relationship("Contribution", back_populates="cycle", cascade="all, delete-orphan")
    payout = relationship("Payout", back_populates="cycle", uselist=False, cascade="all, delete-orphan")
