from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import re
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.core.phone import normalize_phone
from app.models.user import User
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.contribution import Contribution
from app.models.payment import Payment
from app.models.payout import Payout
from app.models.debt import Debt
from app.services.sms_service import SMSService
from app.schemas.tontine_membership import (
    InviteAckResponse,
    PendingInviteResponse,
    TontineMembershipCreate,
    TontineMembershipResponse,
    TontineMembershipUpdate,
    UserWithMembership
)

router = APIRouter(prefix="/tontine-memberships", tags=["tontine-memberships"])


def _ensure_owner_or_admin(db: Session, tontine: Tontine, current_user: User) -> None:
    is_owner = tontine.owner_id == current_user.id
    if is_owner:
        return

    admin_membership = db.query(TontineMembership).filter(
        TontineMembership.user_id == current_user.id,
        TontineMembership.tontine_id == tontine.id,
        TontineMembership.role == "admin",
        TontineMembership.is_active.is_(True),
    ).first()
    if not admin_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can perform this action",
        )


def _tontine_has_started(db: Session, tontine_id: int) -> bool:
    return (
        db.query(TontineCycle.id)
        .filter(TontineCycle.tontine_id == tontine_id)
        .first()
        is not None
    )


def _next_payout_position(db: Session, tontine_id: int) -> int:
    max_pos = (
        db.query(TontineMembership.payout_position)
        .filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.payout_position.isnot(None),
        )
        .order_by(TontineMembership.payout_position.desc())
        .first()
    )
    return (max_pos[0] if max_pos and max_pos[0] else 0) + 1


def _sync_total_cycles_to_active_members(db: Session, tontine: Tontine) -> None:
    if not tontine:
        return
    status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
    # Keep proportionality in draft lifecycle; avoid mutating historical schedule after start.
    if status_value != TontineStatus.DRAFT.value:
        return
    active_count = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.is_active.is_(True),
        )
        .count()
    )
    tontine.total_cycles = max(1, active_count, tontine.current_cycle)


def _normalize_phone(phone: str) -> str:
    return normalize_phone(phone)


def _send_registration_invite_sms(phone: str, tontine_name: str, inviter_name: str) -> tuple[bool, str | None]:
    register_link = f"{settings.FRONTEND_URL.rstrip('/')}/register"
    message = (
        f"{inviter_name} invited you to join tontine '{tontine_name}'. "
        f"Create your account here: {register_link}"
    )
    try:
        SMSService.send_sms(phone, message)
        return True, None
    except Exception as exc:
        return False, str(exc)


# -------------------------
# Join a tontine (as member)
# -------------------------
@router.post("/join", response_model=TontineMembershipResponse, status_code=status.HTTP_201_CREATED)
def join_tontine(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Self-join is disabled. Memberships must be created by tontine owner/admin.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Self-join is disabled. Ask tontine owner/admin to add you."
    )


# -------------------------
# Add member to tontine (admin only)
# -------------------------
@router.post("/add", response_model=TontineMembershipResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    membership_data: TontineMembershipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Backward-compatible endpoint. Behaves like invite (creates pending membership).
    """
    # Check if tontine exists and current user is owner or admin
    tontine = db.query(Tontine).filter(Tontine.id == membership_data.tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )

    _ensure_owner_or_admin(db, tontine, current_user)

    has_started = _tontine_has_started(db, membership_data.tontine_id)
    if membership_data.payout_position is not None:
        if has_started:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot set payout_position after tontine has started",
            )
    
    # Resolve target user by user_id or phone
    user = None
    normalized_phone = _normalize_phone(membership_data.phone or "") if membership_data.phone else None

    if membership_data.user_id is not None:
        user = db.query(User).filter(User.id == membership_data.user_id).first()
    elif normalized_phone:
        user = db.query(User).filter(User.phone == normalized_phone).first()

    if not user:
        if normalized_phone:
            sms_sent, sms_error = _send_registration_invite_sms(
                phone=normalized_phone,
                tontine_name=tontine.name,
                inviter_name=current_user.name,
            )
            if sms_sent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        "User not found in app. Invitation SMS sent to this phone. "
                        "Ask them to register, then invite again."
                    ),
                )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "User not found in app and invitation SMS could not be sent. "
                    "Use E.164 format (e.g. +14165551234) and check Twilio trial restrictions "
                    "(verified destination number required). "
                    f"SMS error: {sms_error or 'unknown error'}"
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a member
    existing_membership = db.query(TontineMembership).filter(
        TontineMembership.user_id == user.id,
        TontineMembership.tontine_id == membership_data.tontine_id
    ).first()
    
    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this tontine"
        )
    
    payout_position = membership_data.payout_position
    if payout_position is None and not has_started:
        # FIFO: each new member added before start is appended to the end.
        payout_position = _next_payout_position(db, membership_data.tontine_id)

    # Create pending membership (invite)
    membership = TontineMembership(
        user_id=user.id,
        tontine_id=membership_data.tontine_id,
        role=membership_data.role or "member",
        is_active=False,
        payout_position=payout_position
    )
    
    db.add(membership)
    db.commit()
    db.refresh(membership)
    
    return membership


# -------------------------
# Invite member (owner/admin only)
# -------------------------
@router.post("/invite", response_model=InviteAckResponse, status_code=status.HTTP_201_CREATED)
def invite_member(
    membership_data: TontineMembershipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Invite by phone with privacy-safe response.
    Always returns the same success message to avoid revealing registration/delivery status.
    """
    tontine = db.query(Tontine).filter(Tontine.id == membership_data.tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )

    _ensure_owner_or_admin(db, tontine, current_user)

    has_started = _tontine_has_started(db, membership_data.tontine_id)
    if membership_data.payout_position is not None:
        if has_started:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot set payout_position after tontine has started",
            )

    payout_position = membership_data.payout_position
    if payout_position is None and not has_started:
        # FIFO: each new member added before start is appended to the end.
        payout_position = _next_payout_position(db, membership_data.tontine_id)

    if membership_data.phone:
        normalized_phone = _normalize_phone(membership_data.phone)
        user = db.query(User).filter(User.phone == normalized_phone).first()

        if user:
            existing_membership = db.query(TontineMembership).filter(
                TontineMembership.user_id == user.id,
                TontineMembership.tontine_id == membership_data.tontine_id
            ).first()

            if not existing_membership:
                membership = TontineMembership(
                    user_id=user.id,
                    tontine_id=membership_data.tontine_id,
                    role=membership_data.role or "member",
                    is_active=False,
                    payout_position=payout_position
                )
                db.add(membership)
                db.commit()
        else:
            _send_registration_invite_sms(
                phone=normalized_phone,
                tontine_name=tontine.name,
                inviter_name=current_user.name,
            )

        return {"message": "Invite sent (if the number can receive messages)."}

    # Fallback for legacy user_id invites with the same neutral message.
    try:
        add_member(membership_data, db, current_user)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_400_BAD_REQUEST and "already a member" in str(exc.detail).lower():
            return {"message": "Invite sent (if the number can receive messages)."}
        raise

    return {"message": "Invite sent (if the number can receive messages)."}


# -------------------------
# Pending invites for current user
# -------------------------
@router.get("/pending/me", response_model=List[PendingInviteResponse])
def list_my_pending_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TontineMembership, Tontine.name)
        .join(Tontine, Tontine.id == TontineMembership.tontine_id)
        .filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(False),
        )
        .order_by(TontineMembership.joined_at.desc())
        .all()
    )

    return [
        {
            "membership_id": membership.id,
            "tontine_id": membership.tontine_id,
            "tontine_name": tontine_name,
            "invited_at": membership.joined_at,
        }
        for membership, tontine_name in rows
    ]


# -------------------------
# Accept invite
# -------------------------
@router.post("/{membership_id}/accept", response_model=TontineMembershipResponse)
def accept_invite(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = db.query(TontineMembership).filter(TontineMembership.id == membership_id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )

    if membership.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only accept your own invite"
        )

    if membership.is_active:
        return membership

    membership.is_active = True
    tontine = db.query(Tontine).filter(Tontine.id == membership.tontine_id).first()
    _sync_total_cycles_to_active_members(db, tontine)
    db.commit()
    db.refresh(membership)
    return membership


@router.post("/{membership_id}/reject")
def reject_invite(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = db.query(TontineMembership).filter(TontineMembership.id == membership_id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )

    if membership.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reject your own invite"
        )

    if membership.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reject an already active membership"
        )

    db.delete(membership)
    db.commit()
    return {"message": "Invite rejected"}


# -------------------------
# Get tontine members
# -------------------------
@router.get("/tontine/{tontine_id}/members", response_model=List[UserWithMembership])
def get_tontine_members(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all members of a tontine.
    """
    # Check if tontine exists and user has access
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Check if user is owner or active member
    is_owner = tontine.owner_id == current_user.id
    is_member = db.query(TontineMembership).filter(
        TontineMembership.user_id == current_user.id,
        TontineMembership.tontine_id == tontine_id,
        TontineMembership.is_active.is_(True),
    ).first() is not None
    
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tontine"
        )
    
    # Get members with their membership details
    members = db.query(
        TontineMembership.id,
        User,
        TontineMembership.role,
        TontineMembership.payout_position,
        TontineMembership.rotation_position,
        TontineMembership.joined_at,
        TontineMembership.is_active,
    ).join(
        TontineMembership,
        TontineMembership.user_id == User.id
    ).filter(
        TontineMembership.tontine_id == tontine_id
    ).all()
    
    result = []
    for membership_id, user, role, payout_position, rotation_position, joined_at, is_active in members:
        result.append({
            "membership_id": membership_id,
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "membership_role": role,
            "membership_status": "active" if is_active else "pending",
            "payout_position": payout_position,
            "rotation_position": rotation_position,
            "joined_at": joined_at
        })
    
    return result


# -------------------------
# Update member role (admin only)
# -------------------------
@router.put("/{membership_id}", response_model=TontineMembershipResponse)
def update_membership(
    membership_id: int,
    update_data: TontineMembershipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a membership (admin only).
    """
    membership = db.query(TontineMembership).filter(
        TontineMembership.id == membership_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    
    # Check if current user is owner or admin
    tontine = db.query(Tontine).filter(Tontine.id == membership.tontine_id).first()
    is_owner = tontine.owner_id == current_user.id
    
    if not is_owner:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == membership.tontine_id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can update memberships"
            )
    
    # Update fields
    if update_data.role is not None:
        membership.role = update_data.role
    if update_data.is_active is not None:
        membership.is_active = update_data.is_active
    if update_data.payout_position is not None:
        has_started = (
            db.query(TontineCycle.id)
            .filter(TontineCycle.tontine_id == membership.tontine_id)
            .first()
            is not None
        )
        if has_started:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot change payout_position after tontine has started",
            )
        membership.payout_position = update_data.payout_position
    
    db.commit()
    db.refresh(membership)
    
    return membership


# -------------------------
# Leave tontine / Remove member
# -------------------------
@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a member from a tontine.
    """
    membership = db.query(TontineMembership).filter(
        TontineMembership.id == membership_id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found"
        )
    
    # Check if current user is the member themselves or owner/admin
    is_self = membership.user_id == current_user.id
    
    tontine = db.query(Tontine).filter(Tontine.id == membership.tontine_id).first()
    is_owner = tontine.owner_id == current_user.id
    
    if not is_self and not is_owner:
        admin_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == membership.tontine_id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        ).first()
        
        if not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to remove this member"
            )

    if is_self:
        tontine_status = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
        if tontine_status != "draft":
            cycle_one = (
                db.query(TontineCycle)
                .filter(
                    TontineCycle.tontine_id == tontine.id,
                    TontineCycle.cycle_number == 1,
                )
                .first()
            )
            cycle_one_started = bool(
                cycle_one and cycle_one.start_date
            )
            if cycle_one_started:
                if cycle_one.start_date.tzinfo is None:
                    now = datetime.now()
                else:
                    now = datetime.now(cycle_one.start_date.tzinfo)
                cycle_one_started = cycle_one.start_date <= now
            if cycle_one_started:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A member can leave only before the tontine starts",
                )

    has_financial_records = any(
        [
            db.query(Contribution.id).filter(Contribution.membership_id == membership.id).first() is not None,
            db.query(Payment.id).filter(Payment.membership_id == membership.id).first() is not None,
            db.query(Payout.id).filter(Payout.membership_id == membership.id).first() is not None,
            db.query(Debt.id).filter(
                (Debt.debtor_membership_id == membership.id) | (Debt.coverer_membership_id == membership.id)
            ).first()
            is not None,
        ]
    )
    if has_financial_records:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Member cannot be removed because financial records exist",
        )
    
    tontine_id = membership.tontine_id
    db.delete(membership)
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    _sync_total_cycles_to_active_members(db, tontine)
    db.commit()
    
    return None
