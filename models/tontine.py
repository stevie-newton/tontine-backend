from enum import Enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class TontineStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"


class TontineFrequency(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Tontine(Base):
    __tablename__ = "tontines"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)
    contribution_amount = Column(Numeric(12, 2), nullable=False)  # amount per cycle
    frequency = Column(String(20), nullable=False)  # weekly | monthly

    total_cycles = Column(Integer, nullable=False)  # total number of cycles for the tontine
    current_cycle = Column(Integer, default=1, nullable=False)

    status = Column(
        SQLEnum(TontineStatus),
        default=TontineStatus.DRAFT,
        nullable=False
    )

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("User", back_populates="tontines")
    memberships = relationship("TontineMembership", back_populates="tontine", cascade="all, delete-orphan")
