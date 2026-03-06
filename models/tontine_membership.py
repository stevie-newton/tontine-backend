from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Boolean, Numeric, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class TontineMembership(Base):
    __tablename__ = "tontine_memberships"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tontine_id = Column(Integer, ForeignKey("tontines.id"), nullable=False)

    role = Column(String(20), default="member")  # admin | member
    is_active = Column(Boolean, default=True)

    payout_position = Column(Integer, nullable=True)  # order of receiving payout
    rotation_position = Column(Integer, nullable=True)  # frozen order once tontine starts

    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="memberships")
    tontine = relationship("Tontine", back_populates="memberships")
    contributions = relationship("Contribution", back_populates="membership")
    payouts = relationship("Payout", back_populates="membership")
