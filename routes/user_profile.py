from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.delete("/me")
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    active_owned = (
        db.query(Tontine.id)
        .filter(
            Tontine.owner_id == current_user.id,
            Tontine.status == TontineStatus.ACTIVE,
        )
        .first()
        is not None
    )
    if active_owned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete account while owning an active tontine group",
        )

    active_membership = (
        db.query(TontineMembership.id)
        .join(Tontine, Tontine.id == TontineMembership.tontine_id)
        .filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(True),
            Tontine.status == TontineStatus.ACTIVE,
        )
        .first()
        is not None
    )
    if active_membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete account while member of an active tontine group",
        )

    try:
        db.delete(current_user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete account because related financial records exist",
        )

    return {"message": "Account deleted successfully"}


@router.get("/me/reliability")
def get_my_reliability(
    tontine_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reliability score based on due cycles and debt behavior.

    Score components:
    - On-time ratio (45%)
    - Completion ratio for due cycles (35%)
    - Debt repayment ratio (20%)
    - Open debt penalty (-10%)
    """
    memberships_query = db.query(TontineMembership).filter(TontineMembership.user_id == current_user.id)
    if tontine_id is not None:
        memberships_query = memberships_query.filter(TontineMembership.tontine_id == tontine_id)
    memberships = memberships_query.all()

    membership_ids = [m.id for m in memberships]
    tontine_ids = list({m.tontine_id for m in memberships})
    now = datetime.now(timezone.utc)

    contributions = []
    if membership_ids:
        contributions = (
            db.query(Contribution)
            .filter(
                Contribution.membership_id.in_(membership_ids),
                Contribution.is_confirmed.is_(True),
            )
            .all()
        )
    contribution_by_pair = {(c.membership_id, c.cycle_id): c for c in contributions}

    cycles = []
    if tontine_ids:
        cycles_query = db.query(TontineCycle).filter(TontineCycle.tontine_id.in_(tontine_ids))
        if tontine_id is not None:
            cycles_query = cycles_query.filter(TontineCycle.tontine_id == tontine_id)
        cycles = cycles_query.all()
    cycles_by_tontine: dict[int, list[TontineCycle]] = {}
    for cycle in cycles:
        cycles_by_tontine.setdefault(cycle.tontine_id, []).append(cycle)

    expected_due_cycles = 0
    cycles_completed = 0
    on_time_contributions = 0
    late_payments = 0
    missed_payments = 0

    for membership in memberships:
        tontine_cycles = cycles_by_tontine.get(membership.tontine_id, [])
        for cycle in tontine_cycles:
            deadline = cycle.contribution_deadline or cycle.end_date
            cutoff = deadline + timedelta(hours=int(cycle.grace_period_hours or 0))
            is_due = cycle.is_closed or cutoff <= now
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

    debtor_membership_query = (
        db.query(Debt)
        .join(TontineMembership, TontineMembership.id == Debt.debtor_membership_id)
        .filter(TontineMembership.user_id == current_user.id)
    )
    if tontine_id is not None:
        debtor_membership_query = debtor_membership_query.filter(Debt.tontine_id == tontine_id)
    debts = debtor_membership_query.all()

    debts_created = len(debts)
    debts_repaid = sum(1 for d in debts if d.is_repaid)
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

    return {
        "user_id": current_user.id,
        "tontine_id": tontine_id,
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
