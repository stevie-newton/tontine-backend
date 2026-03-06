from datetime import datetime, timedelta, timezone

from app.models.contribution import Contribution
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.reminder_service import send_pre_deadline_sms_reminders
from tests.helpers import seed_tontine_with_one_cycle


def test_auto_sms_reminders_one_day_before_deadline(db_session, current_user, monkeypatch):
    recipient = User(name="Reminder User", phone="+237600000001", hashed_password="fake")
    db_session.add(recipient)
    db_session.commit()
    db_session.refresh(recipient)

    tontine, cycle, _owner_membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    recipient_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=recipient.id,
        is_active=True,
        role="member",
        payout_position=2,
    )
    db_session.add(recipient_membership)
    db_session.commit()
    db_session.refresh(recipient_membership)

    now = datetime.now(timezone.utc)
    cycle.contribution_deadline = now + timedelta(hours=23)
    cycle.payout_member_id = current_user.id
    db_session.commit()

    sent_to: list[str] = []

    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: True))
    monkeypatch.setattr(
        "app.services.sms_service.SMSService.send_sms",
        staticmethod(lambda to_phone, message: sent_to.append(to_phone) or "sid-1"),
    )

    stats = send_pre_deadline_sms_reminders(db_session, now=now)
    assert stats["cycles_checked"] == 1
    assert stats["cycles_marked"] == 1
    assert stats["sms_sent"] == 1
    assert sent_to == [recipient.phone]

    db_session.refresh(cycle)
    assert cycle.pre_deadline_sms_sent_at is not None

    # Second run should not re-send for the same cycle.
    second = send_pre_deadline_sms_reminders(db_session, now=now + timedelta(minutes=10))
    assert second["cycles_checked"] == 0
    assert second["sms_sent"] == 0


def test_auto_sms_skips_members_with_confirmed_contribution(db_session, current_user, monkeypatch):
    recipient = User(name="Paid User", phone="+237600000002", hashed_password="fake")
    db_session.add(recipient)
    db_session.commit()
    db_session.refresh(recipient)

    tontine, cycle, owner_membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    recipient_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=recipient.id,
        is_active=True,
        role="member",
        payout_position=2,
    )
    db_session.add(recipient_membership)
    db_session.commit()
    db_session.refresh(recipient_membership)

    contribution = Contribution(
        membership_id=recipient_membership.id,
        cycle_id=cycle.id,
        amount=tontine.contribution_amount,
        transaction_reference="TX-ALREADY-PAID",
        beneficiary_decision="confirmed",
        is_confirmed=True,
        ledger_entry_created=True,
    )
    db_session.add(contribution)

    cycle.contribution_deadline = datetime.now(timezone.utc) + timedelta(hours=20)
    cycle.payout_member_id = owner_membership.user_id
    db_session.commit()

    sent_to: list[str] = []

    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: True))
    monkeypatch.setattr(
        "app.services.sms_service.SMSService.send_sms",
        staticmethod(lambda to_phone, message: sent_to.append(to_phone) or "sid-2"),
    )

    stats = send_pre_deadline_sms_reminders(db_session)
    assert stats["cycles_checked"] == 1
    assert stats["sms_sent"] == 0
    assert sent_to == []
