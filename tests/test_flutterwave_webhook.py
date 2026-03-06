import base64
import hashlib
import hmac
import json
from decimal import Decimal

from app.core.config import settings
from app.models.contribution import Contribution
from app.models.payment import Payment
from app.models.transaction_ledger import TransactionLedger
from app.services.flutterwave_service import FlutterwaveService
from tests.helpers import seed_tontine_with_one_cycle


def _signed_webhook_payload(secret_hash: str, tx_id: int, tx_ref: str) -> tuple[bytes, str]:
    payload = {
        "event": "charge.completed",
        "data": {
            "id": tx_id,
            "tx_ref": tx_ref,
        },
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    digest = hmac.new(secret_hash.encode("utf-8"), raw, hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode("utf-8")
    return raw, signature


def test_flutterwave_webhook_confirms_payment_and_creates_records(client, db_session, current_user, monkeypatch):
    monkeypatch.setattr(settings, "FLW_SECRET_HASH", "test-secret-hash")

    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    tx_ref = "tx-ref-success-001"
    payment = Payment(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        provider="FLUTTERWAVE",
        external_id=tx_ref,
        status="pending",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)

    def fake_get_charge(*, charge_id: str):
        assert charge_id == "9001"
        return {
            "data": {
                "id": 9001,
                "status": "successful",
                "amount": "25.00",
                "currency": "XAF",
                "reference": tx_ref,
            },
        }

    monkeypatch.setattr(FlutterwaveService, "get_charge", staticmethod(fake_get_charge))

    raw, signature = _signed_webhook_payload("test-secret-hash", tx_id=9001, tx_ref=tx_ref)
    response = client.post(
        "/payments/flutterwave/webhook",
        data=raw,
        headers={
            "Content-Type": "application/json",
            "flutterwave-signature": signature,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True

    updated_payment = db_session.query(Payment).filter(Payment.id == payment.id).first()
    assert updated_payment is not None
    assert updated_payment.status == "confirmed"
    assert updated_payment.provider_reference == "9001"
    assert updated_payment.contribution_id is not None

    contribution = db_session.query(Contribution).filter(Contribution.id == updated_payment.contribution_id).first()
    assert contribution is not None
    assert contribution.membership_id == membership.id
    assert contribution.cycle_id == cycle.id
    assert Decimal(str(contribution.amount)) == Decimal("25.00")

    assert contribution.is_confirmed is False
    assert contribution.beneficiary_decision == "pending"
    assert contribution.ledger_entry_created is False

    ledger = db_session.query(TransactionLedger).filter(TransactionLedger.contribution_id == contribution.id).first()
    assert ledger is None


def test_flutterwave_webhook_is_idempotent(client, db_session, current_user, monkeypatch):
    monkeypatch.setattr(settings, "FLW_SECRET_HASH", "test-secret-hash")

    _, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    tx_ref = "tx-ref-idempotent-001"
    payment = Payment(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        provider="FLUTTERWAVE",
        external_id=tx_ref,
        status="pending",
    )
    db_session.add(payment)
    db_session.commit()

    def fake_get_charge(*, charge_id: str):
        return {
            "data": {
                "id": int(charge_id),
                "status": "successful",
                "amount": "25.00",
                "currency": "XAF",
                "reference": tx_ref,
            },
        }

    monkeypatch.setattr(FlutterwaveService, "get_charge", staticmethod(fake_get_charge))

    raw, signature = _signed_webhook_payload("test-secret-hash", tx_id=777, tx_ref=tx_ref)
    headers = {
        "Content-Type": "application/json",
        "flutterwave-signature": signature,
    }

    r1 = client.post("/payments/flutterwave/webhook", data=raw, headers=headers)
    r2 = client.post("/payments/flutterwave/webhook", data=raw, headers=headers)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text

    contribution_count = db_session.query(Contribution).filter(
        Contribution.cycle_id == cycle.id,
        Contribution.membership_id == membership.id,
    ).count()
    assert contribution_count == 1

    ledger_count = db_session.query(TransactionLedger).join(
        Contribution, Contribution.id == TransactionLedger.contribution_id
    ).filter(
        Contribution.cycle_id == cycle.id,
        Contribution.membership_id == membership.id,
    ).count()
    assert ledger_count == 0
