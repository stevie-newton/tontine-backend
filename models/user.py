from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    preferred_language = Column(String(5), nullable=False, server_default="en")
    is_phone_verified = Column(Boolean, nullable=False, server_default="true")
    is_global_admin = Column(Boolean, nullable=False, server_default="false")
    hashed_password = Column(String, nullable=False)
    password_reset_code_hash = Column(String(128), nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_attempts = Column(Integer, nullable=False, server_default="0")
    password_reset_requested_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tontines = relationship("Tontine", back_populates="owner", cascade="all, delete-orphan")
    memberships = relationship("TontineMembership", back_populates="user", cascade="all, delete-orphan")
