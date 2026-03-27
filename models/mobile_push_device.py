from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class MobilePushDevice(Base):
    __tablename__ = "mobile_push_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    expo_push_token = Column(String(255), nullable=False)
    platform = Column(String(20), nullable=False)
    device_name = Column(String(255), nullable=True)
    app_version = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("expo_push_token", name="uq_mobile_push_devices_expo_push_token"),
        Index("ix_mobile_push_devices_user_active", "user_id", "is_active"),
    )
