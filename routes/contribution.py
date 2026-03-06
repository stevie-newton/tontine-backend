from decimal import Decimal
from datetime import datetime, timedelta, timezone

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
from app.services.sms_service import SMSService


router = APIRouter(prefix="/contributions", tags=["contributions"])


class ContributionCreate(BaseModel):
    cycle_id: int
    amount: Decimal
    transaction_reference: str
    proof_screenshot_url: str | None = None


class BeneficiaryDecisionRequest(BaseModel):
    decision: str


class ReminderRequest(BaseModel):
    channels: list[str] = ["sms"]


def _resolve_cycle_beneficiary(db: Session, cycle: TontineCycle) -> TontineMembership:
    def has_open_debt(membership_id: int) -> bool:
        return (
            db.query(Debt.id)
            .filter(
                Debt.tontine_id == cycle.tontine_id,
                Debt.debtor_membership_id == membership_id,
                Debt.is_repaid.is_(False),
            )
            .first()
            is not None
        )

    if cycle.payout_member_id:
        membership = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == cycle.tontine_id,
                TontineMembership.user_id == cycle.payout_member_id,
                TontineMembership.is_active.is_(True),
            )
            .first()
        )
        if membership and not has_open_debt(membership.id):
            return membership

    eligible = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.payout_position == cycle.cycle_number,
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if eligible and not has_open_debt(eligible.id):
        return eligible

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Beneficiary is not assigned for this cycle",
    )


def _ensure_cycle_access(db: Session, cycle: TontineCycle, current_user: User) -> None:
    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this cycle")


def _deadline_and_cutoff(cycle: TontineCycle) -> tuple[datetime, datetime]:
    deadline = cycle.contribution_deadline or cycle.end_date
    grace = int(cycle.grace_period_hours or 0)
    return deadline, deadline + timedelta(hours=grace)


def _cycle_member_statuses(db: Session, cycle: TontineCycle) -> list[dict]:
    deadline, cutoff = _deadline_and_cutoff(cycle)
    beneficiary_membership_id: int | None = None
    try:
        beneficiary_membership = _resolve_cycle_beneficiary(db, cycle)
        beneficiary_membership_id = beneficiary_membership.id
    except HTTPException:
        beneficiary_membership_id = None

    members = (
        db.query(TontineMembership.id, User.id, User.name, User.phone)
        .join(User, User.id == TontineMembership.user_id)
        .filter(
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.is_active.is_(True),
        )
        .all()
    )
    rows = (
        db.query(Contribution)
        .filter(
            Contribution.cycle_id == cycle.id,
            Contribution.is_confirmed.is_(True),
        )
        .all()
    )
    by_membership = {c.membership_id: c for c in rows}

    statuses: list[dict] = []
    for membership_id, user_id, name, phone in members:
        # Only exempt a beneficiary when the cycle has an explicit payout member assigned.
        if cycle.payout_member_id and beneficiary_membership_id is not None and membership_id == beneficiary_membership_id:
            # Beneficiary is exempt from contribution for their payout cycle.
            continue
        contribution = by_membership.get(membership_id)
        if not contribution:
            statuses.append(
                {
                    "membership_id": membership_id,
                    "user_id": user_id,
                    "name": name,
                    "phone": phone,
                    "status": "missing",
                    "paid_at": None,
                    "amount": None,
                }
            )
            continue

        paid_at = contribution.paid_at
        is_on_time = paid_at is not None and paid_at <= cutoff
        statuses.append(
            {
                "membership_id": membership_id,
                "user_id": user_id,
                "name": name,
                "phone": phone,
                "status": "on_time" if is_on_time else "late",
                "paid_at": paid_at,
                "amount": contribution.amount,
            }
        )
    return statuses


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_contribution(
    payload: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == payload.cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")
    if cycle.is_closed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cycle is closed")

    membership = (
        db.query(TontineMembership)
        .filter(
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.user_id == current_user.id,
            TontineMembership.is_active.is_(True),
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not an active member")

    beneficiary_membership = _resolve_cycle_beneficiary(db, cycle)
    if cycle.payout_member_id and beneficiary_membership.id == membership.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Beneficiary should not contribute in their payout cycle",
        )

    existing = (
        db.query(Contribution)
        .filter(
            Contribution.membership_id == membership.id,
            Contribution.cycle_id == cycle.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Contribution already submitted")

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

    expected_amount = Decimal(str(tontine.contribution_amount))
    if payload.amount != expected_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contribution amount must be {expected_amount}",
        )
    tx_ref = payload.transaction_reference.strip()
    if not tx_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transaction_reference is required",
        )

    contribution = Contribution(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=payload.amount,
        transaction_reference=tx_ref,
        proof_screenshot_url=payload.proof_screenshot_url,
        beneficiary_decision="pending",
        is_confirmed=False,
        ledger_entry_created=False,
    )
    db.add(contribution)
    db.commit()
    db.refresh(contribution)

    beneficiary_user = db.query(User).filter(User.id == beneficiary_membership.user_id).first()

    notification_sent = False
    if beneficiary_user and beneficiary_user.phone and SMSService.is_configured():
        try:
            SMSService.send_sms(
                beneficiary_user.phone,
                (
                    f"Confirm receipt: {payload.amount} XAF from {current_user.name}. "
                    f"Ref: {tx_ref}."
                ),
            )
            notification_sent = True
        except Exception:
            notification_sent = False

    return {
        "id": contribution.id,
        "membership_id": contribution.membership_id,
        "cycle_id": contribution.cycle_id,
        "amount": contribution.amount,
        "transaction_reference": contribution.transaction_reference,
        "proof_screenshot_url": contribution.proof_screenshot_url,
        "beneficiary_decision": contribution.beneficiary_decision,
        "is_confirmed": contribution.is_confirmed,
        "ledger_entry_created": contribution.ledger_entry_created,
        "beneficiary_user_id": beneficiary_membership.user_id,
        "beneficiary_user_name": beneficiary_user.name if beneficiary_user else None,
        "notification_sent": notification_sent,
        "paid_at": contribution.paid_at,
    }


@router.post("/{contribution_id}/beneficiary-confirmation")
def beneficiary_confirm_contribution(
    contribution_id: int,
    payload: BeneficiaryDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
    if not contribution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")

    cycle = db.query(TontineCycle).filter(TontineCycle.id == contribution.cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")

    beneficiary_membership = _resolve_cycle_beneficiary(db, cycle)
    if beneficiary_membership.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only this cycle beneficiary can confirm/reject",
        )

    decision = payload.decision.strip().lower()
    if decision not in {"confirm", "reject"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be either 'confirm' or 'reject'",
        )

    now = datetime.now(timezone.utc)
    contribution.confirmed_by_user_id = current_user.id
    contribution.confirmed_at = now

    if decision == "reject":
        contribution.is_confirmed = False
        contribution.beneficiary_decision = "rejected"
        db.commit()
        db.refresh(contribution)
        return {
            "id": contribution.id,
            "decision": contribution.beneficiary_decision,
            "is_confirmed": contribution.is_confirmed,
            "ledger_entry_created": contribution.ledger_entry_created,
            "confirmed_at": contribution.confirmed_at,
        }

    contribution.is_confirmed = True
    contribution.beneficiary_decision = "confirmed"
    if not contribution.ledger_entry_created:
        existing_ledger = (
            db.query(TransactionLedger)
            .filter(TransactionLedger.contribution_id == contribution.id)
            .first()
        )
        if not existing_ledger:
            tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
            if not tontine:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

            ledger = TransactionLedger(
                tontine_id=tontine.id,
                cycle_id=cycle.id,
                membership_id=contribution.membership_id,
                contribution_id=contribution.id,
                entry_type="contribution",
                amount=contribution.amount,
                description=f"Confirmed contribution ({contribution.transaction_reference})",
            )
            db.add(ledger)
        contribution.ledger_entry_created = True

    db.commit()
    db.refresh(contribution)
    return {
        "id": contribution.id,
        "decision": contribution.beneficiary_decision,
        "is_confirmed": contribution.is_confirmed,
        "ledger_entry_created": contribution.ledger_entry_created,
        "confirmed_at": contribution.confirmed_at,
    }


@router.get("/cycle/{cycle_id}")
def list_cycle_contributions(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")
    _ensure_cycle_access(db, cycle, current_user)

    rows = (
        db.query(Contribution, TontineMembership.user_id, User.name, User.phone)
        .join(TontineMembership, TontineMembership.id == Contribution.membership_id)
        .join(User, User.id == TontineMembership.user_id)
        .filter(Contribution.cycle_id == cycle_id)
        .order_by(Contribution.id.asc())
        .all()
    )

    return {
        "cycle_id": cycle_id,
        "count": len(rows),
        "contributions": [
            {
                "id": contribution.id,
                "membership_id": contribution.membership_id,
                "user_id": user_id,
                "user_name": name,
                "user_phone": phone,
                "amount": contribution.amount,
                "transaction_reference": contribution.transaction_reference,
                "proof_screenshot_url": contribution.proof_screenshot_url,
                "beneficiary_decision": contribution.beneficiary_decision,
                "is_confirmed": contribution.is_confirmed,
                "ledger_entry_created": contribution.ledger_entry_created,
                "paid_at": contribution.paid_at,
            }
            for contribution, user_id, name, phone in rows
        ],
    }


@router.get("/cycle/{cycle_id}/status")
def cycle_contribution_status(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")
    _ensure_cycle_access(db, cycle, current_user)

    member_statuses = _cycle_member_statuses(db, cycle)
    paid_members = [
        {"membership_id": m["membership_id"], "user_id": m["user_id"], "name": m["name"]}
        for m in member_statuses
        if m["status"] in {"on_time", "late"}
    ]
    missing_members = [
        {"membership_id": m["membership_id"], "user_id": m["user_id"], "name": m["name"]}
        for m in member_statuses
        if m["status"] == "missing"
    ]

    total_received = sum(
        (Decimal(str(m["amount"])) for m in member_statuses if m["status"] in {"on_time", "late"} and m["amount"] is not None),
        start=Decimal("0.00"),
    )
    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    expected_total = Decimal("0.00")
    if tontine:
        expected_total = Decimal(str(tontine.contribution_amount)) * Decimal(len(member_statuses))

    deadline, cutoff = _deadline_and_cutoff(cycle)
    on_time_count = sum(1 for m in member_statuses if m["status"] == "on_time")
    late_count = sum(1 for m in member_statuses if m["status"] == "late")
    missing_count = sum(1 for m in member_statuses if m["status"] == "missing")

    return {
        "cycle_id": cycle_id,
        "tontine_id": cycle.tontine_id,
        "deadline": deadline,
        "deadline_with_grace": cutoff,
        "grace_period_hours": int(cycle.grace_period_hours or 0),
        "expected_members": len(member_statuses),
        "paid_count": len(paid_members),
        "on_time_count": on_time_count,
        "late_count": late_count,
        "missing_count": missing_count,
        "is_fully_funded": len(missing_members) == 0,
        "total_received": total_received,
        "expected_total": expected_total,
        "paid_members": paid_members,
        "missing_members": missing_members,
        "member_statuses": member_statuses,
    }


@router.post("/cycle/{cycle_id}/reminders/send")
def send_cycle_reminders(
    cycle_id: int,
    payload: ReminderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle not found")

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tontine not found")

    if tontine.owner_id != current_user.id:
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
                detail="Only owner or admin can send reminders",
            )

    statuses = _cycle_member_statuses(db, cycle)
    targets = [m for m in statuses if m["status"] in {"missing", "late"}]
    if not targets:
        return {
            "cycle_id": cycle_id,
            "count": 0,
            "channels": payload.channels,
            "sent": [],
        }

    deadline, cutoff = _deadline_and_cutoff(cycle)
    sent: list[dict] = []
    sms_enabled = "sms" in [c.lower() for c in payload.channels]
    for target in targets:
        sms_result = "skipped"
        if sms_enabled and target.get("phone") and SMSService.is_configured():
            try:
                SMSService.send_sms(
                    target["phone"],
                    (
                        f"Reminder: contribution for cycle {cycle.cycle_number} is {target['status']}. "
                        f"Deadline: {deadline.isoformat()} (grace until {cutoff.isoformat()})."
                    ),
                )
                sms_result = "sent"
            except Exception:
                sms_result = "failed"
        elif sms_enabled:
            sms_result = "not_configured"

        sent.append(
            {
                "membership_id": target["membership_id"],
                "user_id": target["user_id"],
                "name": target["name"],
                "status": target["status"],
                "sms": sms_result,
                "email": "pending_integration" if "email" in [c.lower() for c in payload.channels] else "skipped",
                "push": "pending_integration" if "push" in [c.lower() for c in payload.channels] else "skipped",
            }
        )

    return {
        "cycle_id": cycle_id,
        "count": len(sent),
        "channels": payload.channels,
        "sent": sent,
    }
