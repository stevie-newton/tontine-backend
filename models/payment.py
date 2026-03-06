from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    String,
    Numeric,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    membership_id = Column(
        Integer,
        ForeignKey("tontine_memberships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cycle_id = Column(
        Integer,
        ForeignKey("tontine_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contribution_id = Column(
        Integer,
        ForeignKey("contributions.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )

    amount = Column(Numeric(12, 2), nullable=False)

    # provider = FLUTTERWAVE
    provider = Column(String(50), nullable=False, server_default="FLUTTERWAVE")
    # external_id = your tx_ref
    external_id = Column(String(120), nullable=False, unique=True)
    # provider_reference = Flutterwave transaction id
    provider_reference = Column(String(120), nullable=True, unique=True)

    status = Column(String(20), nullable=False, server_default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    membership = relationship("TontineMembership")
    cycle = relationship("TontineCycle")
    contribution = relationship("Contribution")

    __table_args__ = (
        Index("ix_payments_provider", "provider"),
        Index("ix_payments_status", "status"),
        Index("ix_payments_cycle_membership", "cycle_id", "membership_id"),
    )
