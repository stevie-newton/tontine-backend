from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.contribution import Contribution
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from tests.helpers import seed_tontine_with_one_cycle


def test_cycle_status_on_time_late_missing_and_reminders(client, db_session, current_user):
    late_user = User(name="LateUser", phone="888", hashed_password="fake")
    missing_user = User(name="MissingUser", phone="999", hashed_password="fake")
    db_session.add_all([late_user, missing_user])
    db_session.commit()
    db_session.refresh(late_user)
    db_session.refresh(missing_user)

    tontine, cycle, owner_membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    late_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=late_user.id,
        is_active=True,
        role="member",
        payout_position=2,
    )
    missing_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=missing_user.id,
        is_active=True,
        role="member",
        payout_position=3,
    )
    db_session.add_all([late_membership, missing_membership])
    db_session.commit()
    db_session.refresh(late_membership)
    db_session.refresh(missing_membership)

    now = datetime.now(timezone.utc)
    deadline = now - timedelta(hours=4)
    cycle.contribution_deadline = deadline
    cycle.grace_period_hours = 1

    c_on_time = Contribution(
        membership_id=owner_membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        transaction_reference="REF-DL-ON-TIME",
        beneficiary_decision="confirmed",
        is_confirmed=True,
        ledger_entry_created=True,
        paid_at=deadline - timedelta(minutes=30),
    )
    c_late = Contribution(
        membership_id=late_membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        transaction_reference="REF-DL-LATE",
        beneficiary_decision="confirmed",
        is_confirmed=True,
        ledger_entry_created=True,
        paid_at=deadline + timedelta(hours=2),
    )
    db_session.add_all([c_on_time, c_late])
    db_session.commit()

    r_status = client.get(f"/contributions/cycle/{cycle.id}/status")
    assert r_status.status_code == 200, r_status.text
    body = r_status.json()
    assert body["on_time_count"] == 1
    assert body["late_count"] == 1
    assert body["missing_count"] == 1

    r_reminders = client.post(
        f"/contributions/cycle/{cycle.id}/reminders/send",
        json={"channels": ["sms", "email", "push"]},
    )
    assert r_reminders.status_code == 200, r_reminders.text
    reminders = r_reminders.json()
    assert reminders["count"] == 2
