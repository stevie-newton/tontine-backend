from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.transaction_ledger import TransactionLedger
from app.models.user import User


router = APIRouter(prefix="/debts", tags=["debts"])


class CoverPaymentCreate(BaseModel):
    cycle_id: int
    debtor_membership_id: int
    coverer_membership_id: int
    amount: Decimal
    notes: str | None = None


def _ensure_owner_or_admin(db: Session, tontine: Tontine, current_user: User) -> None:
    if getattr(current_user, "is_global_admin", False):
        return

    if tontine.owner_id == current_user.id:
        return
    admin = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.user_id == current_user.id,
            TontineMembership.role == "admin",
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can perform this action",
        )


def _ensure_member_access(db: Session, tontine: Tontine, current_user: User) -> None:
    if getattr(current_user, "is_global_admin", False):
        return

    if tontine.owner_id == current_user.id:
        return
    membership = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tontine",
        )


@router.post("/cover-payment", status_code=status.HTTP_201_CREATED)
def record_cover_payment(
    payload: CoverPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == payload.cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")
    if cycle.is_closed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cycle is already closed")

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")
    _ensure_owner_or_admin(db, tontine, current_user)

    debtor = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.id == payload.debtor_membership_id,
            TontineMembership.tontine_id == tontine.id,
        )
        .first()
    )
    if not debtor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debtor membership not found in tontine")

    coverer = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.id == payload.coverer_membership_id,
            TontineMembership.tontine_id == tontine.id,
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if not coverer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coverer membership not found or inactive")
    if debtor.id == coverer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debtor and coverer must be different")

    expected = Decimal(str(tontine.contribution_amount))
    if Decimal(str(payload.amount)) != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cover amount must equal cycle contribution amount ({expected})",
        )

    existing_confirmed = (
        db.query(Contribution)
        .filter(
            Contribution.cycle_id == cycle.id,
            Contribution.membership_id == debtor.id,
            Contribution.is_confirmed.is_(True),
        )
        .first()
    )
    if existing_confirmed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Debtor already has confirmed contribution")

    existing_debt = (
        db.query(Debt)
        .filter(
            Debt.cycle_id == cycle.id,
            Debt.debtor_membership_id == debtor.id,
        )
        .first()
    )
    if existing_debt:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Debt already exists for this debtor in cycle")

    contribution = (
        db.query(Contribution)
        .filter(
            Contribution.cycle_id == cycle.id,
            Contribution.membership_id == debtor.id,
        )
        .first()
    )
    tx_ref = f"COVER-{cycle.id}-{debtor.id}-{int(datetime.now(timezone.utc).timestamp())}"
    if contribution:
        contribution.amount = expected
        contribution.transaction_reference = contribution.transaction_reference or tx_ref
        contribution.beneficiary_decision = "confirmed"
        contribution.is_confirmed = True
        contribution.ledger_entry_created = True
    else:
        contribution = Contribution(
            membership_id=debtor.id,
            cycle_id=cycle.id,
            amount=expected,
            transaction_reference=tx_ref,
            beneficiary_decision="confirmed",
            is_confirmed=True,
            ledger_entry_created=True,
        )
        db.add(contribution)
        db.flush()

    debt = Debt(
        tontine_id=tontine.id,
        cycle_id=cycle.id,
        debtor_membership_id=debtor.id,
        coverer_membership_id=coverer.id,
        amount=expected,
        is_repaid=False,
        notes=payload.notes,
    )
    db.add(debt)

    ledger = TransactionLedger(
        tontine_id=tontine.id,
        cycle_id=cycle.id,
        membership_id=coverer.id,
        contribution_id=contribution.id,
        entry_type="contribution",
        amount=expected,
        description=f"Cover payment for member #{debtor.id}",
    )
    db.add(ledger)

    db.commit()
    db.refresh(debt)
    return {
        "id": debt.id,
        "tontine_id": debt.tontine_id,
        "cycle_id": debt.cycle_id,
        "debtor_membership_id": debt.debtor_membership_id,
        "coverer_membership_id": debt.coverer_membership_id,
        "amount": debt.amount,
        "is_repaid": debt.is_repaid,
        "notes": debt.notes,
        "created_at": debt.created_at,
    }


@router.get("/tontine/{tontine_id}")
def list_tontine_debts(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")
    _ensure_member_access(db, tontine, current_user)

    debtor_user = User.__table__.alias("debtor_user")
    coverer_user = User.__table__.alias("coverer_user")
    debtor_membership = TontineMembership.__table__.alias("debtor_membership")
    coverer_membership = TontineMembership.__table__.alias("coverer_membership")

    rows = (
        db.query(
            Debt,
            debtor_user.c.id.label("debtor_user_id"),
            debtor_user.c.name.label("debtor_name"),
            coverer_user.c.id.label("coverer_user_id"),
            coverer_user.c.name.label("coverer_name"),
        )
        .join(debtor_membership, debtor_membership.c.id == Debt.debtor_membership_id)
        .join(coverer_membership, coverer_membership.c.id == Debt.coverer_membership_id)
        .join(debtor_user, debtor_user.c.id == debtor_membership.c.user_id)
        .join(coverer_user, coverer_user.c.id == coverer_membership.c.user_id)
        .filter(Debt.tontine_id == tontine_id)
        .order_by(Debt.created_at.desc())
        .all()
    )

    return {
        "tontine_id": tontine_id,
        "count": len(rows),
        "debts": [
            {
                "id": debt.id,
                "cycle_id": debt.cycle_id,
                "debtor_membership_id": debt.debtor_membership_id,
                "debtor_user_id": debtor_user_id,
                "debtor_name": debtor_name,
                "coverer_membership_id": debt.coverer_membership_id,
                "coverer_user_id": coverer_user_id,
                "coverer_name": coverer_name,
                "amount": debt.amount,
                "is_repaid": debt.is_repaid,
                "notes": debt.notes,
                "created_at": debt.created_at,
                "repaid_at": debt.repaid_at,
            }
            for debt, debtor_user_id, debtor_name, coverer_user_id, coverer_name in rows
        ],
    }


@router.post("/{debt_id}/repay")
def repay_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")

    tontine = db.query(Tontine).filter(Tontine.id == debt.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")
    _ensure_owner_or_admin(db, tontine, current_user)

    if debt.is_repaid:
        return {
            "id": debt.id,
            "is_repaid": debt.is_repaid,
            "repaid_at": debt.repaid_at,
        }

    debt.is_repaid = True
    debt.repaid_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(debt)
    return {
        "id": debt.id,
        "is_repaid": debt.is_repaid,
        "repaid_at": debt.repaid_at,
    }
