from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, Index
from sqlalchemy.sql import func

from app.core.database import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    endpoint = Column(String(1000), nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)

    user_agent = Column(String(255), nullable=True)

    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),
        Index("ix_push_subscriptions_user_active", "user_id", "is_active"),
    )

