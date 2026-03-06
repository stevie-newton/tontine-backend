from decimal import Decimal

from app.models.debt import Debt
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from tests.helpers import seed_tontine_with_one_cycle


def test_cover_payment_creates_debt_suspends_debtor_and_allows_close(client, db_session, current_user):
    debtor_user = User(name="Debtor", phone="444", hashed_password="fake")
    db_session.add(debtor_user)
    db_session.commit()
    db_session.refresh(debtor_user)

    tontine, cycle, owner_membership = seed_tontine_with_one_cycle(
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

    # Owner pays own contribution and beneficiary confirms.
    r_submit = client.post(
        "/contributions/",
        json={"cycle_id": cycle.id, "amount": "25.00", "transaction_reference": "REF-COVER-1"},
    )
    assert r_submit.status_code == 201, r_submit.text
    contribution_id = r_submit.json()["id"]
    r_confirm = client.post(
        f"/contributions/{contribution_id}/beneficiary-confirmation",
        json={"decision": "confirm"},
    )
    assert r_confirm.status_code == 200, r_confirm.text

    # Cannot close yet (debtor missing).
    r_close_fail = client.post(f"/cycles/{cycle.id}/close")
    assert r_close_fail.status_code == 400, r_close_fail.text

    # Record cover payment by owner for debtor.
    r_cover = client.post(
        "/debts/cover-payment",
        json={
            "cycle_id": cycle.id,
            "debtor_membership_id": debtor_membership.id,
            "coverer_membership_id": owner_membership.id,
            "amount": "25.00",
            "notes": "Covered this cycle",
        },
    )
    assert r_cover.status_code == 201, r_cover.text
    debt_id = r_cover.json()["id"]

    debtor_refreshed = db_session.query(TontineMembership).filter(TontineMembership.id == debtor_membership.id).first()
    assert debtor_refreshed is not None
    assert debtor_refreshed.is_active is True

    # Now cycle can close because missing amount is covered.
    r_close_ok = client.post(f"/cycles/{cycle.id}/close")
    assert r_close_ok.status_code == 200, r_close_ok.text

    debt = db_session.query(Debt).filter(Debt.id == debt_id).first()
    assert debt is not None
    assert debt.is_repaid is False

    # Repay debt closes debt record.
    r_repay = client.post(f"/debts/{debt_id}/repay")
    assert r_repay.status_code == 200, r_repay.text
    debtor_after_repay = db_session.query(TontineMembership).filter(TontineMembership.id == debtor_membership.id).first()
    assert debtor_after_repay is not None
    assert debtor_after_repay.is_active is True
