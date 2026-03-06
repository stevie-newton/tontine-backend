# tests/test_contributions.py
from app.models.user import User
from tests.helpers import seed_tontine_with_one_cycle


def test_member_can_contribute(client, db_session, current_user):
    # create another user to be the "member"
    member = User(
        name="Member",
        phone="1111111111",
        hashed_password="fake",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)

    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )
    # NOTE: we used current_user as member_user_id because get_current_user is overridden to current_user

    payload = {
        "cycle_id": cycle.id,
        "amount": "25.00",
        "transaction_reference": "REF-1001",
    }
    r = client.post("/contributions/", json=payload)

    assert r.status_code == 201, r.text
    data = r.json()
    assert data["cycle_id"] == cycle.id
    assert str(data["amount"]) in ("25.0", "25.00", "25")  # serialization may vary
    assert data["is_confirmed"] is False
    assert data["ledger_entry_created"] is False
    assert data["beneficiary_decision"] == "pending"


def test_duplicate_contribution_returns_409(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    payload = {
        "cycle_id": cycle.id,
        "amount": "25.00",
        "transaction_reference": "REF-1002",
    }

    r1 = client.post("/contributions/", json=payload)
    assert r1.status_code == 201, r1.text

    r2 = client.post("/contributions/", json=payload)
    # If you implemented IntegrityError -> 409 (recommended)
    assert r2.status_code in (400, 409), r2.text


def test_beneficiary_confirms_contribution_and_creates_ledger(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    submit = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-1003"},
    )
    assert submit.status_code == 201, submit.text
    contribution_id = submit.json()["id"]

    confirm = client.post(
        f"/contributions/{contribution_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert body["decision"] == "confirmed"
    assert body["is_confirmed"] is True
    assert body["ledger_entry_created"] is True
