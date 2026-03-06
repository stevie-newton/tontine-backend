from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.payout import Payout
from app.models.payment import Payment
from app.models.transaction_ledger import TransactionLedger
from app.models.user import User
from app.schemas.tontine import TontineCreate, TontineResponse, TontineUpdate

router = APIRouter(prefix="/tontines", tags=["Tontines"])


def _active_member_count(db: Session, tontine_id: int) -> int:
    return (
        db.query(func.count(TontineMembership.id))
        .filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def _sync_total_cycles_to_active_members(db: Session, tontine: Tontine) -> None:
    active_count = _active_member_count(db, tontine.id)
    target_total = max(1, active_count, tontine.current_cycle)
    tontine.total_cycles = target_total


# -------------------------
# Create a tontine
# -------------------------
@router.post("/", response_model=TontineResponse, status_code=status.HTTP_201_CREATED)
def create_tontine(
    tontine_data: TontineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new tontine.
    """
    # New tontine starts with owner as first active member, so total_cycles starts at 1.
    current_cycle = tontine_data.current_cycle or 1
    if current_cycle > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="current_cycle cannot be greater than total_cycles"
        )
    
     # Convert status string to enum value if provided
    status_value = tontine_data.status
    if status_value:
       if status_value.upper() in ["DRAFT", "ACTIVE", "COMPLETED"]:
          status_value = status_value.lower()  # Convert to lowercase for enum
    else:
       status_value = TontineStatus.DRAFT.value  # Default to DRAFT if not provided

    tontine = Tontine(
        name=tontine_data.name,
        contribution_amount=tontine_data.contribution_amount,
        total_cycles=1,
        current_cycle=current_cycle,
        status=status_value or TontineStatus.DRAFT.value,
        frequency=tontine_data.frequency,
        owner_id=current_user.id,
    )

    db.add(tontine)
    db.flush()  # get tontine.id before creating owner membership

    owner_membership = TontineMembership(
        user_id=current_user.id,
        tontine_id=tontine.id,
        role="admin",
        is_active=True,
        payout_position=1,
    )
    db.add(owner_membership)
    _sync_total_cycles_to_active_members(db, tontine)
    db.commit()
    db.refresh(tontine)

    return tontine


# -------------------------
# List my tontines
# -------------------------
@router.get("/", response_model=List[TontineResponse])
def list_my_tontines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned_tontines = (
        db.query(Tontine)
        .filter(Tontine.owner_id == current_user.id)
        .order_by(Tontine.created_at.desc())
        .all()
    )

    joined_tontines = (
        db.query(Tontine)
        .join(TontineMembership, TontineMembership.tontine_id == Tontine.id)
        .filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(True),
        )
        .order_by(Tontine.created_at.desc())
        .all()
    )

    tontines_by_id = {t.id: t for t in owned_tontines}
    for tontine in joined_tontines:
        tontines_by_id.setdefault(tontine.id, tontine)

    return sorted(tontines_by_id.values(), key=lambda t: t.created_at, reverse=True)


@router.get("/{tontine_id}/reliability")
def list_tontine_member_reliability(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found",
        )

    is_owner = tontine.owner_id == current_user.id
    admin_membership = (
        db.query(TontineMembership.id)
        .filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.user_id == current_user.id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if not is_owner and not admin_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can perform this action",
        )

    members = (
        db.query(TontineMembership, User)
        .join(User, User.id == TontineMembership.user_id)
        .filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        )
        .all()
    )

    cycles = db.query(TontineCycle).filter(TontineCycle.tontine_id == tontine_id).all()
    cycle_ids = [c.id for c in cycles]
    contributions = []
    if cycle_ids:
        contributions = (
            db.query(Contribution)
            .filter(
                Contribution.cycle_id.in_(cycle_ids),
                Contribution.is_confirmed.is_(True),
            )
            .all()
        )
    contribution_by_pair = {(c.membership_id, c.cycle_id): c for c in contributions}

    debts = db.query(Debt).filter(Debt.tontine_id == tontine_id).all()
    debts_by_debtor: dict[int, list[Debt]] = {}
    for debt in debts:
        debts_by_debtor.setdefault(debt.debtor_membership_id, []).append(debt)

    now_utc = datetime.now(timezone.utc)

    def cycle_is_due(cycle: TontineCycle) -> tuple[bool, datetime]:
        deadline = cycle.contribution_deadline or cycle.end_date
        cutoff = deadline + timedelta(hours=int(cycle.grace_period_hours or 0))
        if cycle.is_closed:
            return True, cutoff
        if cutoff.tzinfo is None:
            return cutoff <= datetime.now()
        return cutoff <= now_utc

    rows = []
    for membership, user in members:
        expected_due_cycles = 0
        cycles_completed = 0
        on_time_contributions = 0
        late_payments = 0
        missed_payments = 0

        for cycle in cycles:
            is_due, cutoff = cycle_is_due(cycle)
            if not is_due:
                continue
            expected_due_cycles += 1

            contribution = contribution_by_pair.get((membership.id, cycle.id))
            if not contribution:
                missed_payments += 1
                continue

            cycles_completed += 1
            if contribution.paid_at and contribution.paid_at <= cutoff:
                on_time_contributions += 1
            else:
                late_payments += 1

        member_debts = debts_by_debtor.get(membership.id, [])
        debts_created = len(member_debts)
        debts_repaid = sum(1 for d in member_debts if d.is_repaid)
        open_debts = debts_created - debts_repaid

        on_time_ratio = (on_time_contributions / expected_due_cycles) if expected_due_cycles else 1.0
        completion_ratio = (cycles_completed / expected_due_cycles) if expected_due_cycles else 1.0
        debt_repaid_ratio = (debts_repaid / debts_created) if debts_created else 1.0
        open_debt_ratio = (open_debts / debts_created) if debts_created else 0.0

        raw_score = (
            (on_time_ratio * 0.45)
            + (completion_ratio * 0.35)
            + (debt_repaid_ratio * 0.20)
            - (open_debt_ratio * 0.10)
        ) * 100.0
        reliability_score_percent = max(0, min(100, round(raw_score)))

        rows.append(
            {
                "membership_id": membership.id,
                "user_id": user.id,
                "name": user.name,
                "reliability_score_percent": reliability_score_percent,
                "expected_due_cycles": expected_due_cycles,
                "cycles_completed": cycles_completed,
                "on_time_contributions": on_time_contributions,
                "late_payments": late_payments,
                "missed_payments": missed_payments,
                "debts_created": debts_created,
                "debts_repaid": debts_repaid,
                "open_debts": open_debts,
            }
        )

    rows.sort(key=lambda x: (-x["reliability_score_percent"], x["name"]))
    return {"tontine_id": tontine_id, "count": len(rows), "members": rows}

@router.get("/{tontine_id}", response_model=TontineResponse)
def get_tontine(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific tontine by ID.
    """
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )

    if tontine.owner_id != current_user.id:
        membership = db.query(TontineMembership).filter(
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(True),
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this tontine",
            )
    
    return tontine

# -------------------------
# Update tontine (optional addition)
# -------------------------
@router.put("/{tontine_id}", response_model=TontineResponse)
def update_tontine(
    tontine_id: int,
    tontine_data: TontineCreate,  # You might want a TontineUpdate schema
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a tontine.
    """
    tontine = db.query(Tontine).filter(
        Tontine.id == tontine_id,
        Tontine.owner_id == current_user.id
    ).first()
    
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )
    
    # Update fields
    tontine.name = tontine_data.name
    tontine.contribution_amount = tontine_data.contribution_amount
    tontine.frequency = tontine_data.frequency
    # Total cycles must stay proportional to active members.
    active_count = _active_member_count(db, tontine.id)
    if tontine_data.total_cycles > max(active_count, 1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="total_cycles cannot be greater than active members",
        )
    tontine.total_cycles = max(tontine_data.total_cycles, tontine.current_cycle)
    tontine.current_cycle = tontine_data.current_cycle or tontine.current_cycle
    
    # Convert status if provided
    if tontine_data.status:
        if tontine_data.status.upper() in ["DRAFT", "ACTIVE", "COMPLETED"]:
            tontine.status = tontine_data.status.lower()
    
    # Validate
    if tontine.current_cycle > tontine.total_cycles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="current_cycle cannot be greater than total_cycles"
        )
    
    db.commit()
    db.refresh(tontine)
    
    return tontine


# -------------------------
# Delete tontine (optional addition)
# -------------------------
@router.delete("/{tontine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tontine(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a tontine.
    """
    tontine = db.query(Tontine).filter(
        Tontine.id == tontine_id,
        Tontine.owner_id == current_user.id
    ).first()
    
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found"
        )

    tontine_status = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
    has_contributions = (
        db.query(Contribution.id)
        .join(TontineCycle, TontineCycle.id == Contribution.cycle_id)
        .filter(TontineCycle.tontine_id == tontine.id)
        .first()
        is not None
    )
    if tontine_status != TontineStatus.DRAFT.value and has_contributions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tontine cannot be deleted after it has started with contributions",
        )
    
    cycle_ids = [
        row_id
        for (row_id,) in db.query(TontineCycle.id).filter(TontineCycle.tontine_id == tontine.id).all()
    ]
    try:
        # Delete dependent rows first to satisfy FK constraints on databases without full ON DELETE CASCADE.
        db.query(TransactionLedger).filter(TransactionLedger.tontine_id == tontine.id).delete(synchronize_session=False)
        db.query(Debt).filter(Debt.tontine_id == tontine.id).delete(synchronize_session=False)
        if cycle_ids:
            db.query(Payout).filter(Payout.cycle_id.in_(cycle_ids)).delete(synchronize_session=False)
            db.query(Payment).filter(Payment.cycle_id.in_(cycle_ids)).delete(synchronize_session=False)
            db.query(Contribution).filter(Contribution.cycle_id.in_(cycle_ids)).delete(synchronize_session=False)
            db.query(TontineCycle).filter(TontineCycle.id.in_(cycle_ids)).delete(synchronize_session=False)
        db.query(TontineMembership).filter(TontineMembership.tontine_id == tontine.id).delete(synchronize_session=False)
        db.delete(tontine)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tontine cannot be deleted due to dependent records",
        )
    
    return None
