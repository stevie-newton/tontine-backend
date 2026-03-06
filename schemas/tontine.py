from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional


# Used when creating a tontine
class TontineCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    contribution_amount: Decimal = Field(..., gt=0)
    frequency: Literal["weekly", "monthly"]
    total_cycles: int = Field(..., gt=0, description="Total number of cycles")
    current_cycle: Optional[int] = Field(1, gt=0)
    status: Optional[Literal["draft", "active", "completed"]] = "draft"
    
    @field_validator("current_cycle")
    @classmethod
    def validate_current_cycle(cls, v, info):
        total_cycles = info.data.get("total_cycles")
        if total_cycles is not None and v > total_cycles:
            raise ValueError("current_cycle cannot be greater than total_cycles")
        return v


# Used when updating a tontine
class TontineUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    contribution_amount: Optional[Decimal] = Field(None, gt=0)
    frequency: Optional[Literal["weekly", "monthly"]] = None
    total_cycles: Optional[int] = Field(None, gt=0)
    current_cycle: Optional[int] = Field(None, gt=0)
    status: Optional[Literal["draft", "active", "completed"]] = None


# Used when returning tontine data
class TontineResponse(BaseModel):
    id: int
    name: str
    contribution_amount: Decimal
    frequency: str
    total_cycles: int  # Add this
    current_cycle: int  # Add this
    status: str  # Add this
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
