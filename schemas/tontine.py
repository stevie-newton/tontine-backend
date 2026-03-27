from pydantic import BaseModel, Field, validator, ConfigDict
from datetime import datetime
from typing import Literal, Optional
from decimal import Decimal


# Used when creating a tontine
class TontineCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    contribution_amount: int = Field(..., gt=0)
    frequency: Literal["weekly", "monthly"]
    total_cycles: int = Field(..., gt=0, description="Total number of cycles")
    current_cycle: Optional[int] = Field(1, gt=0)
    status: Optional[Literal["draft", "active", "completed"]] = "draft"
    
    @validator('current_cycle')
    def validate_current_cycle(cls, v, values):
        if 'total_cycles' in values and v > values['total_cycles']:
            raise ValueError('current_cycle cannot be greater than total_cycles')
        return v


# Used when updating a tontine
class TontineUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    contribution_amount: Optional[int] = Field(None, gt=0)
    frequency: Optional[Literal["weekly", "monthly"]] = None
    total_cycles: Optional[int] = Field(None, gt=0)
    current_cycle: Optional[int] = Field(None, gt=0)
    status: Optional[Literal["draft", "active", "completed"]] = None


# Used when returning tontine data
class TontineResponse(BaseModel):
    id: int
    name: str
    contribution_amount: int
    frequency: str
    total_cycles: int  # Add this
    current_cycle: int  # Add this
    status: str  # Add this
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True