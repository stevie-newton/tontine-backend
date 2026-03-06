from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.debt import Debt
from app.schemas.tontine_cycle import (
    TontineCycleCreate,
    TontineCycleResponse,
    TontineCycleUpdate,
    TontineCycleWithMember
)
from app.services.tontine_service import TontineService

router = APIRouter(prefix="/tontine-cycles", tags=["tontine-cycles"])


class CycleDeadlineUpdate(BaseModel):
    contribution_deadline: datetime
    grace_period_hours: int = Field(0, ge=0)


# -------------------------
# Create cycles for a tontine (automatically on tontine creation)
# -------------------------
@router.post("/generate/{tontine_id}", response_model=List[TontineCycleResponse])
def generate_cycles(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate all cycles for a tontine based on its configuration.
    """
    return TontineService.generate_cycles(db, tontine_id, current_user)


# -------------------------
# Get cycles for a tontine
# -------------------------
@router.get("/tontine/{tontine_id}", response_model=List[TontineCycleWithMember])
def get_tontine_cycles(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all cycles for a specific tontine.
    """
    # Check if tontine exists
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Check if user has access
    if tontine.owner_id != current_user.id:
        membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine"
            )
    
    # Get cycles with member info
    cycles = db.query(TontineCycle).filter(
        TontineCycle.tontine_id == tontine_id
    ).order_by(TontineCycle.cycle_number).all()
    
    # Add member names
    result = []
    for cycle in cycles:
        cycle_data = cycle.__dict__.copy()
        cycle_data["contribution_amount"] = str(tontine.contribution_amount)
        if cycle.payout_member_id:
            member = db.query(User).filter(User.id == cycle.payout_member_id).first()
            if member:
                cycle_data["payout_member_name"] = member.name
                cycle_data["payout_member_phone"] = member.phone
        result.append(cycle_data)
    
    return result


# -------------------------
# Get single cycle
# -------------------------
@router.get("/{cycle_id}", response_model=TontineCycleWithMember)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific cycle by ID.
    """
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )
    
    # Check access
    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if tontine.owner_id != current_user.id:
        membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this cycle"
            )
    
    # Add member info
    cycle_data = cycle.__dict__.copy()
    cycle_data["contribution_amount"] = str(tontine.contribution_amount)
    if cycle.payout_member_id:
        member = db.query(User).filter(User.id == cycle.payout_member_id).first()
        if member:
            cycle_data["payout_member_name"] = member.name
            cycle_data["payout_member_phone"] = member.phone
    
    return cycle_data


# -------------------------
# Assign payout member to a cycle
# -------------------------
@router.put("/{cycle_id}/assign-payout", response_model=TontineCycleResponse)
def assign_payout_member(
    cycle_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign a member to receive payout for this cycle.
    """
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )
    
    # Check if user has permission (owner or admin)
    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    
    if tontine.owner_id != current_user.id:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can assign payout members"
            )
    
    # Check if member exists and is part of tontine
    member = db.query(TontineMembership).filter(
        TontineMembership.user_id == member_id,
        TontineMembership.tontine_id == cycle.tontine_id,
        TontineMembership.is_active.is_(True),
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this tontine"
        )
    has_open_debt = (
        db.query(Debt.id)
        .filter(
            Debt.tontine_id == tontine.id,
            Debt.debtor_membership_id == member.id,
            Debt.is_repaid.is_(False),
        )
        .first()
        is not None
    )
    if has_open_debt:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Member with open debt cannot be selected as beneficiary",
        )
    
    # Update cycle
    cycle.payout_member_id = member_id
    db.commit()
    db.refresh(cycle)
    
    return cycle


# -------------------------
# Close a cycle
# -------------------------
@router.put("/{cycle_id}/close", response_model=TontineCycleResponse)
def close_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Close a cycle with full funding checks."""
    TontineService.close_cycle(db, cycle_id, current_user)
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )
    return cycle


@router.put("/{cycle_id}/deadline", response_model=TontineCycleResponse)
def update_cycle_deadline(
    cycle_id: int,
    payload: CycleDeadlineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found"
        )

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

    if tontine.owner_id != current_user.id:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        ).first()
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can update cycle deadline"
            )

    if cycle.is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update deadline for closed cycle",
        )

    cycle.contribution_deadline = payload.contribution_deadline
    cycle.grace_period_hours = payload.grace_period_hours
    db.commit()
    db.refresh(cycle)
    return cycle


# -------------------------
# Get current active cycle
# -------------------------
@router.get("/tontine/{tontine_id}/current", response_model=TontineCycleResponse)
def get_current_cycle(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current active cycle for a tontine.
    """
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Check access
    if tontine.owner_id != current_user.id:
        membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine"
            )
    
    # Get current cycle
    cycle = db.query(TontineCycle).filter(
        TontineCycle.tontine_id == tontine_id,
        TontineCycle.cycle_number == tontine.current_cycle
    ).first()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current cycle not found"
        )
    
    return cycle
