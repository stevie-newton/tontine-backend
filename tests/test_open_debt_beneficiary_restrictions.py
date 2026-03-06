from datetime import datetime, timedelta, timezone

from app.core.dependencies import get_current_user
from app.main import app
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from tests.helpers import seed_tontine_with_one_cycle


def test_open_debt_member_can_view_and_pay_but_cannot_be_beneficiary(client, db_session, current_user):
    debtor_user = User(name="Debtor X", phone="777", hashed_password="fake")
    db_session.add(debtor_user)
    db_session.commit()
    db_session.refresh(debtor_user)

    tontine, cycle1, owner_membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )
    debtor_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=debtor_user.id,
        is_active=True,
        role="member",
        payout_position=2,
    )
    db_session.add(debtor_membership)
    db_session.commit()
    db_session.refresh(debtor_membership)

    # Owner contribution confirmed for cycle 1.
    r_submit = client.post(
        "/contributions/",
        json={"cycle_id": cycle1.id, "amount": "25.00", "transaction_reference": "REF-OD-1"},
    )
    assert r_submit.status_code == 201, r_submit.text
    contribution_id = r_submit.json()["id"]
    r_confirm = client.post(
        f"/contributions/{contribution_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert r_confirm.status_code == 200, r_confirm.text

    # Owner records cover payment for debtor -> open debt exists.
    r_cover = client.post(
        "/debts/cover-payment",
        json={
            "cycle_id": cycle1.id,
            "debtor_membership_id": debtor_membership.id,
            "coverer_membership_id": owner_membership.id,
            "amount": "25.00",
        },
    )
    assert r_cover.status_code == 201, r_cover.text

    # Create cycle 2 where owner is beneficiary.
    start2 = datetime.now(timezone.utc) + timedelta(days=1)
    cycle2 = TontineCycle(
        tontine_id=tontine.id,
        cycle_number=2,
        payout_member_id=current_user.id,
        start_date=start2,
        end_date=start2 + timedelta(days=7),
        is_closed=False,
    )
    db_session.add(cycle2)
    db_session.commit()
    db_session.refresh(cycle2)

    # Member with open debt can still view group and pay contributions.
    def override_user():
        return debtor_user

    app.dependency_overrides[get_current_user] = override_user
    r_view = client.get(f"/tontines/{tontine.id}")
    assert r_view.status_code == 200, r_view.text
    r_pay = client.post(
        "/contributions/",
        json={"cycle_id": cycle2.id, "amount": "25.00", "transaction_reference": "REF-OD-2"},
    )
    assert r_pay.status_code == 201, r_pay.text

    # Restore owner auth and ensure debtor cannot be assigned manually as beneficiary.
    app.dependency_overrides[get_current_user] = lambda: current_user
    r_assign = client.put(f"/tontine-cycles/{cycle2.id}/assign-payout?member_id={debtor_user.id}")
    assert r_assign.status_code == 409, r_assign.text
    assert "open debt" in r_assign.json()["detail"].lower()
