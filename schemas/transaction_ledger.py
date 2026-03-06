from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class TransactionLedgerBase(BaseModel):
    tontine_id: int
    cycle_id: Optional[int] = None
    user_id: Optional[int] = None
    event_type: str = Field(..., description="Type of transaction: contribution, payout, fee, etc.")
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = None


class TransactionLedgerCreate(TransactionLedgerBase):
    pass


class TransactionLedgerResponse(TransactionLedgerBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TransactionLedgerWithDetails(TransactionLedgerResponse):
    tontine_name: Optional[str] = None
    cycle_number: Optional[int] = None
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class TransactionSummary(BaseModel):
    total_contributions: Decimal
    total_payouts: Decimal
    total_fees: Decimal
    balance: Decimal
    transaction_count: int
    last_transaction_date: Optional[datetime] = None