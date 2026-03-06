from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MembershipRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"


class TontineMembershipBase(BaseModel):
    role: Optional[str] = "member"
    is_active: Optional[bool] = True
    payout_position: Optional[int] = None


class TontineMembershipCreate(TontineMembershipBase):
    user_id: Optional[int] = None
    phone: Optional[str] = None
    tontine_id: int

    @model_validator(mode="after")
    def validate_identity(self):
        if self.user_id is None and (self.phone is None or not self.phone.strip()):
            raise ValueError("Either user_id or phone is required")
        return self


class TontineMembershipUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    payout_position: Optional[int] = None


class TontineMembershipResponse(TontineMembershipBase):
    id: int
    user_id: int
    tontine_id: int
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserWithMembership(BaseModel):
    membership_id: int
    id: int
    name: str
    phone: str
    membership_role: str
    membership_status: str
    payout_position: Optional[int] = None
    rotation_position: Optional[int] = None
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PendingInviteResponse(BaseModel):
    membership_id: int
    tontine_id: int
    tontine_name: str
    invited_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InviteAckResponse(BaseModel):
    message: str
