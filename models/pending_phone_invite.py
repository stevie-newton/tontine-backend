from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PendingPhoneInvite(Base):
    __tablename__ = "pending_phone_invites"
    __table_args__ = (
        UniqueConstraint("phone", "tontine_id", name="uq_pending_phone_invites_phone_tontine"),
    )

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), nullable=False, index=True)
    tontine_id = Column(Integer, ForeignKey("tontines.id", ondelete="CASCADE"), nullable=False)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False, server_default="member")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    tontine = relationship("Tontine")
    invited_by_user = relationship("User")
