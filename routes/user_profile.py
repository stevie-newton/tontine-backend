from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.reliability_service import build_user_reliability_report

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

    Reporting rules:
    - Beneficiary cycles are excluded because the beneficiary does not contribute that turn.
    - "late_payments" counts any non-beneficiary due cycle that was not paid by the cutoff,
      including overdue cycles that are still unpaid.
    - "missed_payments" remains the stricter unpaid subset.
    """
    return build_user_reliability_report(
        db,
        user_id=current_user.id,
        tontine_id=tontine_id,
    )
