from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tontine import Tontine
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.payout import Payout
from app.schemas.payout import (
    PayoutCreate,
    PayoutResponse,
    PayoutUpdate,
    PayoutWithDetails,
    PayoutSummary
)

router = APIRouter(prefix="/payouts", tags=["payouts"])


# -------------------------
# Create a payout record
# -------------------------
@router.post("/", response_model=PayoutResponse, status_code=status.HTTP_201_CREATED)
def create_payout(
    payout_data: PayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a payout record (admin only).
    """
    # Check if tontine exists and user has permission
    tontine = db.query(Tontine).filter(Tontine.id == payout_data.tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Check if user is owner or admin
    if tontine.owner_id != current_user.id:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == payout_data.tontine_id,
            TontineMembership.role == "admin"
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can create payouts"
            )
    
    # Check if cycle exists
    cycle = db.query(TontineCycle).filter(
        TontineCycle.id == payout_data.cycle_id,
        TontineCycle.tontine_id == payout_data.tontine_id
    ).first()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found in this tontine"
        )
    
    # Check if membership exists in this tontine
    membership = db.query(TontineMembership).filter(
        TontineMembership.id == payout_data.membership_id,
        TontineMembership.tontine_id == payout_data.tontine_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found in this tontine"
        )
    
    # Check if payout already exists for this cycle and member
    existing_payout = db.query(Payout).filter(
        Payout.cycle_id == payout_data.cycle_id,
        Payout.membership_id == payout_data.membership_id
    ).first()
    
    if existing_payout:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payout already recorded for this member in this cycle"
        )
    
    # Create payout
    payout = Payout(
        tontine_id=payout_data.tontine_id,
        cycle_id=payout_data.cycle_id,
        membership_id=payout_data.membership_id,
        amount=payout_data.amount,
        is_processed=payout_data.is_processed
    )
    
    db.add(payout)
    db.commit()
    db.refresh(payout)
    
    return payout


# -------------------------
# Get payouts for a tontine
# -------------------------
@router.get("/tontine/{tontine_id}", response_model=List[PayoutWithDetails])
def get_tontine_payouts(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all payouts for a specific tontine.
    """
    # Check if tontine exists
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
    
    # Get payouts with details
    payouts = db.query(
        Payout,
        User.name.label("member_name"),
        User.phone.label("member_phone"),
        TontineCycle.cycle_number
    ).join(
        TontineMembership,
        TontineMembership.id == Payout.membership_id
    ).join(
        User,
        User.id == TontineMembership.user_id
    ).join(
        TontineCycle,
        TontineCycle.id == Payout.cycle_id
    ).filter(
        Payout.tontine_id == tontine_id
    ).order_by(TontineCycle.cycle_number).all()
    
    result = []
    for payout, member_name, member_phone, cycle_number in payouts:
        payout_dict = {
            "id": payout.id,
            "tontine_id": payout.tontine_id,
            "cycle_id": payout.cycle_id,
            "membership_id": payout.membership_id,
            "amount": payout.amount,
            "is_processed": payout.is_processed,
            "processed_at": payout.processed_at,
            "created_at": payout.created_at,
            "member_name": member_name,
            "member_phone": member_phone,
            "cycle_number": cycle_number,
            "tontine_name": tontine.name
        }
        result.append(payout_dict)
    
    return result


# -------------------------
# Get payouts for a cycle
# -------------------------
@router.get("/cycle/{cycle_id}", response_model=List[PayoutWithDetails])
def get_cycle_payouts(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all payouts for a specific cycle.
    """
    # Check if cycle exists
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
                detail="You don't have access to this tontine"
            )
    
    # Get payouts with details
    payouts = db.query(
        Payout,
        User.name.label("member_name"),
        User.phone.label("member_phone")
    ).join(
        TontineMembership,
        TontineMembership.id == Payout.membership_id
    ).join(
        User,
        User.id == TontineMembership.user_id
    ).filter(
        Payout.cycle_id == cycle_id
    ).all()
    
    result = []
    for payout, member_name, member_phone in payouts:
        payout_dict = {
            "id": payout.id,
            "tontine_id": payout.tontine_id,
            "cycle_id": payout.cycle_id,
            "membership_id": payout.membership_id,
            "amount": payout.amount,
            "is_processed": payout.is_processed,
            "processed_at": payout.processed_at,
            "created_at": payout.created_at,
            "member_name": member_name,
            "member_phone": member_phone,
            "cycle_number": cycle.cycle_number,
            "tontine_name": tontine.name
        }
        result.append(payout_dict)
    
    return result


# -------------------------
# Get payouts for a member
# -------------------------
@router.get("/member/{membership_id}", response_model=List[PayoutWithDetails])
def get_member_payouts(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all payouts for a specific member.
    """
    # Check if membership exists
    membership = db.query(TontineMembership).filter(
        TontineMembership.id == membership_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    
    # Check access
    if membership.user_id != current_user.id:
        tontine = db.query(Tontine).filter(Tontine.id == membership.tontine_id).first()
        if tontine.owner_id != current_user.id:
            admin_membership = db.query(TontineMembership).filter(
                TontineMembership.user_id == current_user.id,
                TontineMembership.tontine_id == membership.tontine_id,
                TontineMembership.role == "admin"
            ).first()
            
            if not admin_membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to these payouts"
                )
    
    # Get payouts with details
    payouts = db.query(
        Payout,
        TontineCycle.cycle_number,
        Tontine.name.label("tontine_name")
    ).join(
        TontineCycle,
        TontineCycle.id == Payout.cycle_id
    ).join(
        Tontine,
        Tontine.id == TontineCycle.tontine_id
    ).filter(
        Payout.membership_id == membership_id
    ).order_by(TontineCycle.cycle_number).all()
    
    result = []
    for payout, cycle_number, tontine_name in payouts:
        payout_dict = {
            "id": payout.id,
            "tontine_id": payout.tontine_id,
            "cycle_id": payout.cycle_id,
            "membership_id": payout.membership_id,
            "amount": payout.amount,
            "is_processed": payout.is_processed,
            "processed_at": payout.processed_at,
            "created_at": payout.created_at,
            "cycle_number": cycle_number,
            "tontine_name": tontine_name
        }
        result.append(payout_dict)
    
    return result


# -------------------------
# Get single payout
# -------------------------
@router.get("/{payout_id}", response_model=PayoutWithDetails)
def get_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific payout by ID.
    """
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payout not found"
        )
    
    # Check access
    membership = db.query(TontineMembership).filter(
        TontineMembership.id == payout.membership_id
    ).first()
    
    if membership.user_id != current_user.id:
        tontine = db.query(Tontine).filter(Tontine.id == payout.tontine_id).first()
        if tontine.owner_id != current_user.id:
            admin_membership = db.query(TontineMembership).filter(
                TontineMembership.user_id == current_user.id,
                TontineMembership.tontine_id == payout.tontine_id,
                TontineMembership.role == "admin"
            ).first()
            
            if not admin_membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this payout"
                )
    
    # Get additional details
    cycle = db.query(TontineCycle).filter(
        TontineCycle.id == payout.cycle_id
    ).first()
    
    tontine = db.query(Tontine).filter(
        Tontine.id == payout.tontine_id
    ).first()
    
    member = db.query(User).filter(
        User.id == membership.user_id
    ).first()
    
    payout_dict = {
        "id": payout.id,
        "tontine_id": payout.tontine_id,
        "cycle_id": payout.cycle_id,
        "membership_id": payout.membership_id,
        "amount": payout.amount,
        "is_processed": payout.is_processed,
        "processed_at": payout.processed_at,
        "created_at": payout.created_at,
        "member_name": member.name,
        "member_phone": member.phone,
        "cycle_number": cycle.cycle_number,
        "tontine_name": tontine.name
    }
    
    return payout_dict


# -------------------------
# Update payout (mark as processed)
# -------------------------
@router.put("/{payout_id}", response_model=PayoutResponse)
def update_payout(
    payout_id: int,
    update_data: PayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a payout (admin only).
    """
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payout not found"
        )
    
    # Check if user is owner or admin
    if payout.tontine.owner_id != current_user.id:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == payout.tontine_id,
            TontineMembership.role == "admin"
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can update payouts"
            )
    
    # Update fields
    if update_data.amount is not None:
        payout.amount = update_data.amount
    if update_data.is_processed is not None:
        payout.is_processed = update_data.is_processed
        if update_data.is_processed and not payout.processed_at:
            payout.processed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(payout)
    
    return payout


# -------------------------
# Delete payout
# -------------------------
@router.delete("/{payout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a payout (admin only).
    """
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payout not found"
        )
    
    # Check if user is owner or admin
    if payout.tontine.owner_id != current_user.id:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == payout.tontine_id,
            TontineMembership.role == "admin"
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can delete payouts"
            )
    
    db.delete(payout)
    db.commit()
    
    return None


# -------------------------
# Get payout summary for a tontine
# -------------------------
@router.get("/summary/tontine/{tontine_id}", response_model=PayoutSummary)
def get_tontine_payout_summary(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get summary of payouts for a tontine.
    """
    # Check if tontine exists and user has access
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
    
    # Get payouts for this tontine
    payouts = db.query(Payout).filter(
        Payout.tontine_id == tontine_id
    ).all()
    
    # Calculate summary
    total_payouts = len(payouts)
    processed_count = sum(1 for p in payouts if p.is_processed)
    pending_count = total_payouts - processed_count
    total_amount = sum(p.amount for p in payouts)
    
    last_payout = db.query(Payout).filter(
        Payout.tontine_id == tontine_id
    ).order_by(Payout.processed_at.desc()).first()
    
    return PayoutSummary(
        total_payouts=total_payouts,
        processed_count=processed_count,
        pending_count=pending_count,
        total_amount=total_amount,
        last_payout_date=last_payout.processed_at if last_payout else None
    )