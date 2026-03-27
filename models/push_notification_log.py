from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, Index
from sqlalchemy.sql import func

from app.core.database import Base


class PushNotificationLog(Base):
    __tablename__ = "push_notification_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cycle_id = Column(
        Integer,
        ForeignKey("tontine_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(50), nullable=False)

    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "cycle_id",
            "kind",
            name="uq_push_notification_logs_user_cycle_kind",
        ),
        Index("ix_push_notification_logs_cycle_kind", "cycle_id", "kind"),
    )

