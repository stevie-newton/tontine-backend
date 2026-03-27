from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tontine import Tontine, TontineStatus
from app.models.user import User
from app.schemas.tontine import TontineCreate, TontineResponse, TontineUpdate
from app.models.tontine_membership import TontineMembership
from app.models.tontine_cycle import TontineCycle
from app.models.contribution import Contribution
from app.models.payment import Payment
from app.models.payout import Payout
from app.models.debt import Debt
from app.models.transaction_ledger import TransactionLedger
from app.services.tontine_service import TontineService

router = APIRouter(prefix="/tontines", tags=["Tontines"])


def _draft_total_cycles_for_members(db: Session, tontine_id: int, current_cycle: int) -> int:
    active_count = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        )
        .count()
    )
    return max(1, active_count, current_cycle)


def _sync_draft_tontine_shape(db: Session, tontine: Tontine) -> bool:
    if not tontine:
        return False
    TontineService.sync_draft_payout_order(db, tontine)
    return TontineService.sync_draft_total_cycles(db, tontine)


def _sync_tontine_total_cycles_if_safe(db: Session, tontine: Tontine) -> bool:
    if not tontine:
        return False
    return TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine)


def _tontine_has_financial_activity(db: Session, tontine_id: int) -> bool:
    contribution_exists = (
        db.query(Contribution.id)
        .join(TontineCycle, TontineCycle.id == Contribution.cycle_id)
        .filter(TontineCycle.tontine_id == tontine_id)
        .first()
        is not None
    )
    if contribution_exists:
        return True

    payment_exists = (
        db.query(Payment.id)
        .join(TontineCycle, TontineCycle.id == Payment.cycle_id)
        .filter(TontineCycle.tontine_id == tontine_id)
        .first()
        is not None
    )
    if payment_exists:
        return True

    payout_exists = (
        db.query(Payout.id)
        .filter(Payout.tontine_id == tontine_id)
        .first()
        is not None
    )
    if payout_exists:
        return True

    debt_exists = (
        db.query(Debt.id)
        .filter(Debt.tontine_id == tontine_id)
        .first()
        is not None
    )
    if debt_exists:
        return True

    ledger_exists = (
        db.query(TransactionLedger.id)
        .filter(TransactionLedger.tontine_id == tontine_id)
        .first()
        is not None
    )
    return ledger_exists


def _ensure_owner_or_active_admin(db: Session, tontine: Tontine, current_user: User) -> None:
    is_owner = tontine.owner_id == current_user.id
    if is_owner:
        return

    is_active_admin = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        )
        .first()
        is not None
    )
    if not is_active_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner or an active admin can perform this action",
        )


def _cycle_duration_for_frequency(frequency: str) -> timedelta:
    if frequency == "monthly":
        return timedelta(days=30)
    return timedelta(days=7)


# -------------------------
# Create a tontine
# -------------------------
@router.post("", response_model=TontineResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=TontineResponse, status_code=status.HTTP_201_CREATED)
def create_tontine(
    tontine_data: TontineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new tontine.
    """
    # Validate current_cycle <= total_cycles
    if tontine_data.current_cycle > tontine_data.total_cycles:
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
        total_cycles=tontine_data.total_cycles,
        current_cycle=tontine_data.current_cycle or 1,
        status=status_value or TontineStatus.DRAFT.value,
        frequency=tontine_data.frequency,
        owner_id=current_user.id,
    )

    db.add(tontine)
    db.commit()
    db.refresh(tontine)

    _sync_draft_tontine_shape(db, tontine)
    db.commit()
    db.refresh(tontine)

    return tontine


# -------------------------
# List my tontines
# -------------------------
@router.get("", response_model=List[TontineResponse], include_in_schema=False)
@router.get("/", response_model=List[TontineResponse])
def list_my_tontines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tontines = (
        db.query(Tontine)
        .outerjoin(
            TontineMembership,
            TontineMembership.tontine_id == Tontine.id,
        )
        .filter(
            or_(
                Tontine.owner_id == current_user.id,
                and_(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.is_active.is_(True),
                ),
            )
        )
        .distinct()
        .order_by(Tontine.created_at.desc())
        .all()
    )

    changed = False
    for tontine in tontines:
        changed = _sync_tontine_total_cycles_if_safe(db, tontine) or changed
    if changed:
        db.commit()
        for tontine in tontines:
            db.refresh(tontine)

    return tontines

@router.get("/{tontine_id}", response_model=TontineResponse)
def get_tontine(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tontine = (
        db.query(Tontine)
        .outerjoin(
            TontineMembership,
            TontineMembership.tontine_id == Tontine.id,
        )
        .filter(
            Tontine.id == tontine_id,
            or_(
                Tontine.owner_id == current_user.id,
                and_(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.is_active.is_(True),
                ),
            ),
        )
        .distinct()
        .first()
    )

    if not tontine:
        raise HTTPException(status_code=404, detail="Tontine not found")

    if _sync_tontine_total_cycles_if_safe(db, tontine):
        db.commit()
        db.refresh(tontine)

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

    status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
    if status_value == TontineStatus.DRAFT.value:
        _sync_draft_tontine_shape(db, tontine)
    else:
        tontine.total_cycles = max(tontine.total_cycles, tontine.current_cycle)
    
    db.commit()
    db.refresh(tontine)
    
    return tontine


@router.post("/{tontine_id}/activate", response_model=TontineResponse)
def activate_tontine(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Activate a draft tontine.

    Rules:
    - owner or active admin can activate
    - the tontine must not already be completed
    - cycles must already be generated before activation
    """
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()

    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found",
        )

    _ensure_owner_or_active_admin(db, tontine, current_user)

    status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
    if status_value == TontineStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed tontines cannot be reactivated",
        )
    if status_value == TontineStatus.ACTIVE.value:
        return tontine

    if _sync_draft_tontine_shape(db, tontine):
        db.flush()

    existing_cycles = (
        db.query(TontineCycle.id)
        .filter(TontineCycle.tontine_id == tontine_id)
        .first()
    )
    if not existing_cycles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate cycles before activating this tontine",
        )

    tontine.status = TontineStatus.ACTIVE.value
    db.commit()
    db.refresh(tontine)
    return tontine


@router.post("/{tontine_id}/repair-cycle-plan", response_model=TontineResponse)
def repair_tontine_cycle_plan(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Repair a tontine whose cycle plan no longer matches the active-member count.

    Safe-guardrails:
    - owner or active admin only
    - no financial activity may exist
    - existing cycles are rebuilt from scratch
    """
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tontine not found",
        )

    _ensure_owner_or_active_admin(db, tontine, current_user)

    if _tontine_has_financial_activity(db, tontine_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cycle repair is only allowed before contributions, payments, payouts, "
                "debts, or ledger entries exist."
            ),
        )

    TontineService.sync_rotation_order(db, tontine)
    TontineService.sync_draft_total_cycles(db, tontine)

    db.query(TontineCycle).filter(TontineCycle.tontine_id == tontine_id).delete(synchronize_session=False)

    cycle_duration = _cycle_duration_for_frequency(tontine.frequency)
    start_date = tontine.created_at.replace(hour=0, minute=0, second=0, microsecond=0)

    cycles: list[TontineCycle] = []
    for cycle_number in range(1, tontine.total_cycles + 1):
        cycle_end = start_date + cycle_duration
        cycles.append(
            TontineCycle(
                tontine_id=tontine_id,
                cycle_number=cycle_number,
                start_date=start_date,
                end_date=cycle_end,
                is_closed=False,
            )
        )
        start_date = cycle_end

    if cycles:
        db.add_all(cycles)

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

    if TontineService.has_financial_activity(db, tontine_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This tontine cannot be deleted because financial activity already exists. "
                "Delete is allowed only before contributions, payments, payouts, debts, or ledger entries are created."
            ),
        )

    db.query(TontineCycle).filter(TontineCycle.tontine_id == tontine_id).delete(synchronize_session=False)
    db.query(TontineMembership).filter(TontineMembership.tontine_id == tontine_id).delete(synchronize_session=False)
    
    db.delete(tontine)
    db.commit()
    
    return None
