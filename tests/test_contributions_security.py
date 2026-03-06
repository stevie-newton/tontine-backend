# tests/test_contributions_security.py
from app.models.user import User
from tests.helpers import seed_tontine_with_one_cycle
from app.models.contribution import Contribution


def test_non_member_cannot_contribute(client, db_session, current_user):
    # Create tontine owned by current_user
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session,
        owner_id=current_user.id,
        member_user_id=current_user.id,
    )

    # Create a different user who is NOT a member
    outsider = User(
        name="Outsider",
        phone="999",
        hashed_password="fake",
    )
    db_session.add(outsider)
    db_session.commit()

    # Override auth to simulate outsider
    def override_user():
        return outsider

    from app.main import app
    from app.core.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = override_user

    response = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-2001"},
    )

    assert response.status_code == 403

def test_cannot_contribute_to_closed_cycle(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session,
        owner_id=current_user.id,
        member_user_id=current_user.id,
    )

    # Close cycle manually
    cycle.is_closed = True
    db_session.commit()

    response = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-2002"},
    )

    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower()

def test_cannot_close_cycle_twice(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session,
        owner_id=current_user.id,
        member_user_id=current_user.id,
    )

    # Contribute so cycle can close
    r_submit = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-2003"},
    )
    assert r_submit.status_code == 201
    contribution_id = r_submit.json()["id"]
    r_confirm = client.post(
        f"/contributions/{contribution_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert r_confirm.status_code == 200

    # First close should succeed
    r1 = client.post(f"/cycles/{cycle.id}/close")
    assert r1.status_code == 200

    # Second close should fail
    r2 = client.post(f"/cycles/{cycle.id}/close")

    assert r2.status_code in (400, 409)
