from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class PayoutBase(BaseModel):
    amount: int = Field(..., gt=0, description="Payout amount")
    is_processed: Optional[bool] = False


class PayoutCreate(PayoutBase):
    tontine_id: int
    cycle_id: int
    membership_id: int


class PayoutUpdate(BaseModel):
    amount: Optional[int] = Field(None, gt=0)
    is_processed: Optional[bool] = None


class PayoutResponse(PayoutBase):
    id: int
    tontine_id: int
    cycle_id: int
    membership_id: int
    processed_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PayoutWithDetails(PayoutResponse):
    member_name: Optional[str] = None
    member_phone: Optional[str] = None
    cycle_number: Optional[int] = None
    tontine_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PayoutSummary(BaseModel):
    total_payouts: int
    processed_count: int
    pending_count: int
    total_amount: int
    last_payout_date: Optional[datetime] = None