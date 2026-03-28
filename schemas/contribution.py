from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


MONEY_Q = Decimal("0.01")


def q_money(v: Decimal) -> Decimal:
    return Decimal(v).quantize(MONEY_Q)


class ContributionCreate(BaseModel):
    """
    Member-facing payload.
    membership_id is derived from current_user (prevents spoofing).
    """
    cycle_id: int
    amount: Decimal = Field(..., gt=0, description="Contribution amount (e.g., 25.00)")
    transaction_reference: str = Field(..., min_length=1, max_length=120)
    proof_screenshot_url: Optional[str] = Field(None, max_length=500)

    @field_validator("amount")
    @classmethod
    def normalize_amount(cls, v: Decimal) -> Decimal:
        return q_money(v)


class ContributionUpdate(BaseModel):
    """
    Admin-facing update (optional).
    Typically you only want to update is_confirmed, not amount.
    """
    amount: Optional[Decimal] = Field(None, gt=0)
    is_confirmed: Optional[bool] = None

    @field_validator("amount")
    @classmethod
    def normalize_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return q_money(v) if v is not None else v


class ContributionResponse(BaseModel):
    id: int
    membership_id: int
    cycle_id: int
    amount: Decimal
    transaction_reference: str
    proof_screenshot_url: Optional[str] = None
    beneficiary_decision: str
    is_confirmed: bool
    ledger_entry_created: bool
    paid_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContributionWithDetails(ContributionResponse):
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    cycle_number: Optional[int] = None
    tontine_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ContributionListResponse(BaseModel):
    cycle_id: int
    count: int
    contributions: list[ContributionWithDetails]


class ContributionSummary(BaseModel):
    tontine_id: int
    cycle_id: Optional[int] = None

    total_members: int
    total_contributions: int
    confirmed_contributions: int
    pending_contributions: int

    total_amount: Decimal
    average_per_member: Decimal
    last_contribution_date: Optional[datetime] = None
