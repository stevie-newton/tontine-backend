import re
import uuid
from decimal import Decimal

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.contribution import Contribution
from app.models.payment import Payment
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.transaction_ledger import TransactionLedger
from app.models.user import User
from app.services.flutterwave_service import FlutterwaveService

router = APIRouter(prefix="/payments", tags=["payments"])


def _normalize_phone(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _normalize_charge_status(value: str) -> str:
    status = (value or "").strip().lower()
    if status in {"successful", "success", "paid", "succeeded"}:
        return "successful"
    if status in {"failed", "cancelled", "canceled", "error"}:
        return "failed"
    return "pending"


def _apply_successful_payment(db: Session, payment: Payment, amount_paid: Decimal) -> None:
    cycle = db.query(TontineCycle).filter(TontineCycle.id == payment.cycle_id).first()
    if not cycle:
        payment.status = "failed"
        return

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        payment.status = "failed"
        return

    expected = Decimal(str(tontine.contribution_amount))
    if amount_paid != expected or amount_paid != Decimal(str(payment.amount)):
        payment.status = "failed"
        return

    existing = db.query(Contribution).filter(
        Contribution.cycle_id == payment.cycle_id,
        Contribution.membership_id == payment.membership_id,
    ).first()
    if existing:
        payment.status = "confirmed"
        payment.contribution_id = existing.id
        return

    contribution = Contribution(
        membership_id=payment.membership_id,
        cycle_id=payment.cycle_id,
        amount=amount_paid,
        transaction_reference=payment.external_id,
        beneficiary_decision="pending",
        is_confirmed=False,
        ledger_entry_created=False,
    )
    db.add(contribution)
    db.flush()

    payment.status = "confirmed"
    payment.contribution_id = contribution.id


def _sync_payment_from_charge(db: Session, payment: Payment, charge_data: dict) -> None:
    charge_id = str(charge_data.get("id") or "")
    charge_status = _normalize_charge_status(str(charge_data.get("status") or ""))
    amount_paid = Decimal(str(charge_data.get("amount") or payment.amount))

    if charge_id:
        payment.provider_reference = charge_id

    if charge_status == "successful":
        _apply_successful_payment(db, payment, amount_paid)
    elif charge_status == "failed":
        payment.status = "failed"
    else:
        payment.status = "pending"


@router.post("/flutterwave/initiate")
def flutterwave_initiate(
    cycle_id: int,
    network: str = "mtn",
    country_code: str = "237",
    phone_number: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    if cycle.is_closed:
        raise HTTPException(400, "Cycle already closed")

    tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
    if not tontine:
        raise HTTPException(404, "Tontine not found")

    membership = db.query(TontineMembership).filter(
        TontineMembership.user_id == current_user.id,
        TontineMembership.tontine_id == tontine.id,
        TontineMembership.is_active.is_(True),
    ).first()
    if not membership:
        raise HTTPException(403, "Not an active member")

    existing = db.query(Contribution.id).filter(
        Contribution.cycle_id == cycle.id,
        Contribution.membership_id == membership.id,
    ).first()
    if existing:
        raise HTTPException(400, "Already contributed")

    amount = Decimal(str(tontine.contribution_amount))

    latest_payment = (
        db.query(Payment)
        .filter(
            Payment.membership_id == membership.id,
            Payment.cycle_id == cycle.id,
        )
        .order_by(Payment.id.desc())
        .first()
    )
    if latest_payment:
        # Sync status before deciding whether to block or allow a new attempt.
        if latest_payment.provider_reference and latest_payment.status not in {"confirmed", "failed"}:
            try:
                charge = FlutterwaveService.get_charge(charge_id=latest_payment.provider_reference)
                _sync_payment_from_charge(db, latest_payment, charge.get("data") or {})
                db.commit()
                db.refresh(latest_payment)
            except requests.HTTPError:
                db.rollback()

        if latest_payment.status == "confirmed":
            raise HTTPException(400, "Already contributed")

        if latest_payment.status == "pending":
            instruction = None
            if latest_payment.provider_reference:
                try:
                    charge = FlutterwaveService.get_charge(charge_id=latest_payment.provider_reference)
                    cdata = charge.get("data") or {}
                    next_action = (cdata.get("next_action") or {}).get("payment_instruction") or {}
                    instruction = next_action.get("note")
                except requests.HTTPError:
                    instruction = None

            return {
                "tx_ref": latest_payment.external_id,
                "status": latest_payment.status,
                "charge_id": latest_payment.provider_reference,
                "instruction": instruction,
                "reused": True,
            }

    tx_ref = str(uuid.uuid4())
    normalized_phone = _normalize_phone(phone_number or current_user.phone)
    if not normalized_phone:
        raise HTTPException(400, "Missing phone number for mobile money charge")

    customer_email = f"{normalized_phone}@tontine.local"

    try:
        customer = FlutterwaveService.create_customer(
            email=customer_email,
            first_name=current_user.name or "",
            phone_number=normalized_phone,
        )
        customer_id = (customer.get("data") or {}).get("id")
        if not customer_id:
            raise HTTPException(502, "Flutterwave customer creation missing customer id")

        payment_method = FlutterwaveService.create_mobile_money_payment_method(
            network=network,
            phone_number=normalized_phone,
            country_code=country_code,
        )
        payment_method_id = (payment_method.get("data") or {}).get("id")
        if not payment_method_id:
            raise HTTPException(502, "Flutterwave payment method creation missing id")

        charge = FlutterwaveService.create_charge(
            reference=tx_ref,
            customer_id=str(customer_id),
            payment_method_id=str(payment_method_id),
            amount=str(amount),
            currency="XAF",
        )
    except requests.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    charge_data = charge.get("data") or {}
    next_action = (charge_data.get("next_action") or {}).get("payment_instruction") or {}

    payment = Payment(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=amount,
        provider="FLUTTERWAVE",
        external_id=tx_ref,
        provider_reference=charge_data.get("id"),
        status="pending",
    )
    db.add(payment)
    db.flush()

    _sync_payment_from_charge(db, payment, charge_data)
    db.commit()

    return {
        "tx_ref": tx_ref,
        "status": payment.status,
        "charge_id": payment.provider_reference,
        "instruction": next_action.get("note"),
    }


@router.post("/flutterwave/webhook")
async def flutterwave_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    signature = request.headers.get("flutterwave-signature") or request.headers.get("verif-hash")
    if signature and not FlutterwaveService.verify_webhook_signature(raw_body=raw, signature=signature):
        raise HTTPException(401, "Invalid signature")

    payload = await request.json()
    data = payload.get("data") or {}
    tx_ref = str(data.get("reference") or data.get("tx_ref") or "")
    charge_id = str(data.get("id") or "")
    if not tx_ref and not charge_id:
        return {"ok": True}

    payment_q = db.query(Payment)
    if tx_ref:
        payment_q = payment_q.filter(Payment.external_id == tx_ref)
    else:
        payment_q = payment_q.filter(Payment.provider_reference == charge_id)

    payment = payment_q.first()
    if not payment:
        return {"ok": True}

    if not payment.provider_reference and charge_id:
        payment.provider_reference = charge_id

    if payment.provider_reference:
        try:
            charge = FlutterwaveService.get_charge(charge_id=payment.provider_reference)
            _sync_payment_from_charge(db, payment, charge.get("data") or {})
            db.commit()
        except Exception:
            db.rollback()
            return {"ok": True}

    return {"ok": True}


@router.get("/flutterwave/status")
def flutterwave_status(
    tx_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = (
        db.query(Payment)
        .join(TontineMembership, TontineMembership.id == Payment.membership_id)
        .filter(
            Payment.external_id == tx_ref,
            TontineMembership.user_id == current_user.id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(404, "Payment not found")

    if payment.provider_reference and payment.status not in {"confirmed", "failed"}:
        try:
            charge = FlutterwaveService.get_charge(charge_id=payment.provider_reference)
            _sync_payment_from_charge(db, payment, charge.get("data") or {})
            db.commit()
        except requests.HTTPError as exc:
            raise HTTPException(502, str(exc))

    instruction = None
    if payment.provider_reference:
        try:
            charge = FlutterwaveService.get_charge(charge_id=payment.provider_reference)
            cdata = charge.get("data") or {}
            next_action = (cdata.get("next_action") or {}).get("payment_instruction") or {}
            instruction = next_action.get("note")
        except Exception:
            instruction = None

    return {
        "tx_ref": payment.external_id,
        "status": payment.status,
        "provider": payment.provider,
        "provider_reference": payment.provider_reference,
        "cycle_id": payment.cycle_id,
        "contribution_id": payment.contribution_id,
        "amount": str(payment.amount),
        "instruction": instruction,
    }
