from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.schemas.tontine_cycle import (
    TontineCycleCreate,
    TontineCycleResponse,
    TontineCycleUpdate,
    TontineCycleWithMember
)
from app.schemas.payout import PayoutResponse
from app.services.tontine_service import TontineService

router = APIRouter(prefix="/tontine-cycles", tags=["tontine-cycles"])


# -------------------------
# Create cycles for a tontine
# -------------------------
@router.post("/generate/{tontine_id}", response_model=List[TontineCycleResponse])
def generate_cycles(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate all cycles for a tontine based on its configuration.
    - Only the owner can generate cycles
    - Cycles are generated with proper start/end dates based on frequency
    """
    # Check if tontine exists and user has permission
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Only owner can generate cycles
    if tontine.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can generate cycles"
        )
    
    # Check if cycles already exist
    existing_cycles = db.query(TontineCycle).filter(
        TontineCycle.tontine_id == tontine_id
    ).first()
    
    if existing_cycles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cycles already generated for this tontine"
        )

    TontineService.sync_draft_payout_order(db, tontine)
    TontineService.sync_draft_total_cycles(db, tontine)
    
    # Calculate cycle duration based on frequency
    if tontine.frequency == "weekly":
        cycle_duration = timedelta(days=7)
    elif tontine.frequency == "monthly":
        cycle_duration = timedelta(days=30)
    else:
        cycle_duration = timedelta(days=7)  # Default
    
    # Generate cycles
    cycles = []
    start_date = tontine.created_at.replace(hour=0, minute=0, second=0, microsecond=0)
    
    for i in range(1, tontine.total_cycles + 1):
        cycle_end = start_date + cycle_duration
        payout_member = TontineService._determine_payout_member(db, tontine_id, i)
        
        cycle = TontineCycle(
            tontine_id=tontine_id,
            cycle_number=i,
            payout_member_id=payout_member.user_id if payout_member else None,
            start_date=start_date,
            end_date=cycle_end,
            is_closed=False
        )
        
        cycles.append(cycle)
        start_date = cycle_end
    
    db.add_all(cycles)
    db.commit()
    
    # Refresh to get IDs
    for cycle in cycles:
        db.refresh(cycle)
    
    return cycles


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
    - Accessible by owner and members
    - Includes payout member details if assigned
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
            TontineMembership.tontine_id == tontine_id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine"
            )

    if TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine):
        db.commit()
        db.refresh(tontine)
    
    # Get cycles with member info
    cycles = db.query(TontineCycle).filter(
        TontineCycle.tontine_id == tontine_id
    ).order_by(TontineCycle.cycle_number).all()
    
    # Add member names
    result = []
    for cycle in cycles:
        cycle_data = {
            "id": cycle.id,
            "tontine_id": cycle.tontine_id,
            "cycle_number": cycle.cycle_number,
            "start_date": cycle.start_date,
            "end_date": cycle.end_date,
            "is_closed": cycle.is_closed,
            "closed_at": cycle.closed_at,
            "created_at": cycle.created_at,
            "payout_member_id": cycle.payout_member_id
        }
        
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
    - Accessible by owner and members
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
            TontineMembership.tontine_id == cycle.tontine_id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this cycle"
            )

    if TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine):
        db.commit()
        cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    
    # Build response
    cycle_data = {
        "id": cycle.id,
        "tontine_id": cycle.tontine_id,
        "cycle_number": cycle.cycle_number,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "is_closed": cycle.is_closed,
        "closed_at": cycle.closed_at,
        "created_at": cycle.created_at,
        "payout_member_id": cycle.payout_member_id
    }
    
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
    - Only owner or admin can assign
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
            TontineMembership.role == "admin"
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can assign payout members"
            )
    
    # Check if member exists and is part of tontine
    member = db.query(TontineMembership).filter(
        TontineMembership.user_id == member_id,
        TontineMembership.tontine_id == cycle.tontine_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this tontine"
        )
    
    # Update cycle
    cycle.payout_member_id = member_id
    db.commit()
    db.refresh(cycle)
    
    return cycle


# -------------------------
# Close a cycle
# -------------------------
@router.put("/{cycle_id}/close", response_model=PayoutResponse)
def close_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Close a cycle and process payout.
    Business rules:
    - All members must have contributed
    - Payout member must be assigned
    - Creates a payout record
    - Advances tontine to next cycle
    """
    payout = TontineService.close_cycle(db, cycle_id, current_user)
    return payout


# -------------------------
# Get cycle status summary
# -------------------------
@router.get("/tontine/{tontine_id}/status")
def get_cycle_status(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get status of all cycles for a tontine.
    Shows:
    - Which cycles are closed
    - Contribution counts
    - Payout status
    """
    # Check access
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    if tontine.owner_id != current_user.id:
        membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == tontine_id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine"
            )

    if TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine):
        db.commit()
        db.refresh(tontine)
    
    status_data = TontineService.get_cycle_status(db, tontine_id)
    return status_data


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
            TontineMembership.tontine_id == tontine_id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine"
            )

    if TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine):
        db.commit()
        db.refresh(tontine)
    
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
