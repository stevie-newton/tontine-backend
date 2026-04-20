from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class TontineCycleBase(BaseModel):
    cycle_number: int = Field(..., gt=0)
    payout_member_id: Optional[int] = None
    start_date: datetime
    end_date: datetime
    contribution_deadline: Optional[datetime] = None
    grace_period_hours: int = Field(0, ge=0)
    is_closed: Optional[bool] = False

    @field_validator('end_date')
    @classmethod
    def validate_dates(cls, v, info):
        if 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class TontineCycleCreate(TontineCycleBase):
    tontine_id: int


class TontineCycleUpdate(BaseModel):
    payout_member_id: Optional[int] = None
    contribution_deadline: Optional[datetime] = None
    grace_period_hours: Optional[int] = Field(None, ge=0)
    is_closed: Optional[bool] = None
    closed_at: Optional[datetime] = None


class TontineCycleDeadlineUpdate(BaseModel):
    contribution_deadline: Optional[datetime] = None
    grace_period_hours: Optional[int] = Field(None, ge=0)


class TontineCycleResponse(TontineCycleBase):
    id: int
    tontine_id: int
    closed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class TontineCycleWithMember(TontineCycleResponse):
    contribution_amount: Optional[str] = None
    payout_member_name: Optional[str] = None
    payout_member_phone: Optional[str] = None
