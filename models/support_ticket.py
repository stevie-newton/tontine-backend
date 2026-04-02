from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    requester_name = Column(String(100), nullable=True)
    requester_phone = Column(String(20), nullable=True)
    tontine_id = Column(Integer, ForeignKey("tontines.id"), nullable=True, index=True)
    message = Column(Text, nullable=False)
    screenshot_url = Column(String(500), nullable=True)
    status = Column(String(30), nullable=False, server_default="open")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
