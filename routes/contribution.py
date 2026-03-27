from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tontine import Tontine
from app.models.tontine_membership import TontineMembership
from app.schemas.contribution import (
    ContributionCreate,
    ContributionResponse,
    ContributionUpdate,
    ContributionWithDetails,
    ContributionSummary
)
from app.services.contribution_service import ContributionService

router = APIRouter(prefix="/contributions", tags=["contributions"])

class ConfirmBody(BaseModel):
    confirm: bool = True


class BeneficiaryDecisionBody(BaseModel):
    decision: str

# -------------------------
# Create a contribution (member pays)
# -------------------------
@router.post("", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ContributionResponse, status_code=status.HTTP_201_CREATED)
def create_contribution(
    contribution_data: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a contribution for a cycle.
    
    Business rules:
    - Member must be active in the tontine
    - Cycle must be open
    - Amount must match tontine contribution amount
    - Cannot contribute twice to same cycle
    """

    return ContributionService.create_contribution(
        db=db,
        cycle_id=contribution_data.cycle_id,
        current_user=current_user,
        amount=contribution_data.amount,
        transaction_reference=contribution_data.transaction_reference,
        proof_screenshot_url=contribution_data.proof_screenshot_url,
    )
    


# -------------------------
# Get contributions for a cycle
# -------------------------
@router.get("/cycle/{cycle_id}", response_model=List[ContributionWithDetails])
def get_cycle_contributions(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all contributions for a specific cycle.
    Accessible by owner, admins, and members of the tontine.
    """
    contributions = ContributionService.get_cycle_contributions(
        db=db,
        cycle_id=cycle_id,
        current_user=current_user
    )
    
    return contributions


# -------------------------
# Get contributions for a member
# -------------------------
@router.get("/member/{membership_id}", response_model=List[ContributionWithDetails])
def get_member_contributions(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all contributions for a specific member.
    Accessible by the member themselves, owner, and admins.
    """
    contributions = ContributionService.get_member_contributions(
        db=db,
        membership_id=membership_id,
        current_user=current_user
    )
    
    return contributions


# -------------------------
# Get my contributions in a tontine
# -------------------------
@router.get("/my/{tontine_id}", response_model=List[ContributionWithDetails])
def get_my_contributions(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all contributions for the current user in a specific tontine.
    """
    contributions = ContributionService.get_member_contributions_by_tontine(
        db=db,
        tontine_id=tontine_id,
        current_user=current_user
    )
    
    return contributions


# -------------------------
# Get single contribution
# -------------------------
@router.post("/{contribution_id}/beneficiary-confirmation", response_model=ContributionResponse)
def beneficiary_confirm_contribution(
    contribution_id: int,
    payload: BeneficiaryDecisionBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm or reject a contribution as the cycle beneficiary.
    Ledger entries are created only when the beneficiary confirms.
    """
    contribution = ContributionService.beneficiary_confirm_contribution(
        db=db,
        contribution_id=contribution_id,
        current_user=current_user,
        decision=payload.decision,
    )

    return contribution


@router.get("/{contribution_id}", response_model=ContributionWithDetails)
def get_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific contribution by ID.
    """
    contribution = ContributionService.get_contribution_by_id(
        db=db,
        contribution_id=contribution_id,
        current_user=current_user
    )
    
    return contribution


# -------------------------
# Update contribution (confirm/reject)
# -------------------------
@router.put("/{contribution_id}", response_model=ContributionResponse)
def update_contribution(
    contribution_id: int,
    update_data: ContributionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a contribution (admin only).
    Can modify amount and confirmation status.
    """
    contribution = ContributionService.update_contribution(
        db=db,
        contribution_id=contribution_id,
        update_data=update_data,
        current_user=current_user
    )
    
    return contribution


# -------------------------
# Confirm a contribution (admin only)
# -------------------------
@router.put("/{contribution_id}/confirm", response_model=ContributionResponse)
def confirm_contribution(
    contribution_id: int,
    payload: ConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm or reject a contribution (admin only).
    """
    contribution = ContributionService.confirm_contribution(
        db=db,
        contribution_id=contribution_id,
        current_user=current_user,
        confirm=payload.confirm
    )
    
    return contribution


# -------------------------
# Delete contribution
# -------------------------
@router.delete("/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a contribution (admin only).
    """
    ContributionService.delete_contribution(
        db=db,
        contribution_id=contribution_id,
        current_user=current_user
    )
    
    return None


# -------------------------
# Get contribution summary for a tontine
# -------------------------
@router.get("/summary/tontine/{tontine_id}", response_model=ContributionSummary)
def get_tontine_contribution_summary(
    tontine_id: int,
    cycle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get summary of contributions for a tontine.
    Optionally filter by cycle.
    """
    summary = ContributionService.get_contribution_summary(
        db=db,
        tontine_id=tontine_id,
        cycle_id=cycle_id,
        current_user=current_user
    )
    
    return summary


# -------------------------
# Get contribution status for a cycle
# -------------------------
@router.get("/cycle/{cycle_id}/status")
def get_cycle_contribution_status(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get contribution status for a cycle (who has paid, who hasn't).
    """
    status = ContributionService.get_cycle_contribution_status(
        db=db,
        cycle_id=cycle_id,
        current_user=current_user
    )
    
    return status
