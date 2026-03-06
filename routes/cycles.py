from fastapi import APIRouter, Depends
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tontine import Tontine
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.tontine_service import TontineService


router = APIRouter(prefix="/cycles", tags=["cycles"])


@router.post("/{cycle_id}/close")
def close_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payout = TontineService.close_cycle(db, cycle_id, current_user)
    return {
        "id": payout.id,
        "cycle_id": payout.cycle_id,
        "membership_id": payout.membership_id,
        "amount": payout.amount,
        "is_paid": payout.is_paid,
        "paid_at": payout.paid_at,
        "created_at": payout.created_at,
    }


@router.get("/status/{tontine_id}")
def get_cycle_status(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

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

    return TontineService.get_cycle_status(db, tontine_id)
