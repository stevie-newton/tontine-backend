from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TransactionLedgerBase(BaseModel):
    tontine_id: int
    cycle_id: Optional[int] = None

    # Ledger is tied to a membership (not directly to a user id)
    membership_id: Optional[int] = None
    user_id: Optional[int] = None  # optional convenience for create; resolved to membership_id

    entry_type: str = Field(..., description="contribution | payout | fee | adjustment | refund")
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: Optional[str] = None

    @model_validator(mode="after")
    def _validate_member_or_user(self):
        if self.membership_id is not None and self.user_id is not None:
            raise ValueError("Provide only one of membership_id or user_id")
        return self


class TransactionLedgerCreate(TransactionLedgerBase):
    pass


class TransactionLedgerResponse(BaseModel):
    id: int
    tontine_id: int
    cycle_id: Optional[int] = None
    membership_id: Optional[int] = None
    entry_type: str
    amount: Decimal
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionLedgerWithDetails(TransactionLedgerResponse):
    tontine_name: Optional[str] = None
    cycle_number: Optional[int] = None

    # Derived from membership_id
    user_id: Optional[int] = None
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
