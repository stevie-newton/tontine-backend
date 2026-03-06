# tests/test_close_cycle.py
from decimal import Decimal
from tests.helpers import seed_tontine_with_one_cycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User


def test_close_cycle_missing_contributions(client, db_session, current_user):
    # owner is current_user; we need at least 2 active members but only 1 pays
    # Create another member
    member2 = User(name="M2", phone="222", hashed_password="fake")
    db_session.add(member2)
    db_session.commit()
    db_session.refresh(member2)

    tontine, cycle, membership1 = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    # Add second active member
    membership2 = TontineMembership(
        tontine_id=tontine.id,
        user_id=member2.id,
        is_active=True,
        role="member",
        payout_position=2,
    )
    db_session.add(membership2)
    db_session.commit()

    # Only current_user contributes
    r_pay = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-3001"},
    )
    assert r_pay.status_code == 201, r_pay.text
    contribution_id = r_pay.json()["id"]

    r_confirm = client.post(
        f"/contributions/{contribution_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert r_confirm.status_code == 200, r_confirm.text

    # Try close cycle (should fail due to missing contribution)
    r_close = client.post(f"/cycles/{cycle.id}/close")  # adjust path if your router differs
    assert r_close.status_code == 400, r_close.text
    assert "Missing" in r_close.json()["detail"]


def test_close_cycle_success(client, db_session, current_user):
    # Two members both contribute => close succeeds
    member2 = User(name="M2", phone="222", hashed_password="fake")
    db_session.add(member2)
    db_session.commit()
    db_session.refresh(member2)

    tontine, cycle, membership1 = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    membership2 = TontineMembership(
        tontine_id=tontine.id,
        user_id=member2.id,
        is_active=True,
        role="member",
        payout_position=1,  # keep simple; determine payout will pick position 1
    )
    db_session.add(membership2)
    db_session.commit()

    # Contribute as current_user
    r1 = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-3002"},
    )
    assert r1.status_code == 201, r1.text
    c1_id = r1.json()["id"]
    r1_confirm = client.post(
        f"/contributions/{c1_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert r1_confirm.status_code == 200, r1_confirm.text

    # To contribute as member2, you’d normally need auth switching.
    # For unit tests, easiest approach: create contribution row directly OR override auth again.
    # Here we insert directly:
    from app.models.contribution import Contribution
    c2 = Contribution(
        membership_id=membership2.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        transaction_reference="REF-3003",
        beneficiary_decision="confirmed",
        is_confirmed=True,
        ledger_entry_created=True,
    )
    db_session.add(c2)
    db_session.commit()

    # Close cycle
    r_close = client.post(f"/cycles/{cycle.id}/close")
    assert r_close.status_code == 200, r_close.text
    payout = r_close.json()
    assert payout["cycle_id"] == cycle.id
