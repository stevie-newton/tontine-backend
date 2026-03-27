from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.contribution import Contribution
from app.models.mobile_push_device import MobilePushDevice
from app.models.push_notification_log import PushNotificationLog
from app.models.push_subscription import PushSubscription
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.native_push_service import send_native_push_notifications
from app.services.web_push_service import send_web_push, web_push_is_configured

KIND_PRE_DEADLINE = "pre_deadline"


def send_pre_deadline_web_push_reminders(db: Session, *, now: datetime | None = None) -> dict:
    """
    Send one-time Web Push reminders for cycles due within the configured lookahead window.

    This is the "true push" channel for the web app: works even when the tab is closed,
    as long as the user has granted permission and has an active PushSubscription.
    """
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    web_push_configured = web_push_is_configured()

    lookahead = timedelta(hours=max(1, int(settings.AUTO_REMINDER_LOOKAHEAD_HOURS)))
    window_end = current_time + lookahead

    deadline_expr = func.coalesce(TontineCycle.contribution_deadline, TontineCycle.end_date)

    cycles = (
        db.query(TontineCycle)
        .filter(
            TontineCycle.is_closed.is_(False),
            deadline_expr.isnot(None),
            deadline_expr > current_time,
            deadline_expr <= window_end,
        )
        .all()
    )

    push_sent = 0
    push_failed = 0
    subscriptions_used = 0
    subscriptions_deactivated = 0
    mobile_devices_used = 0
    native_push_sent = 0
    native_push_failed = 0
    mobile_devices_deactivated = 0
    targets = 0

    for cycle in cycles:
        tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
        if not tontine:
            continue

        paid_membership_ids = {
            membership_id
            for (membership_id,) in (
                db.query(Contribution.membership_id)
                .filter(
                    Contribution.cycle_id == cycle.id,
                    Contribution.is_confirmed.is_(True),
                )
                .all()
            )
        }

        already_notified_user_ids = {
            user_id
            for (user_id,) in (
                db.query(PushNotificationLog.user_id)
                .filter(
                    PushNotificationLog.cycle_id == cycle.id,
                    PushNotificationLog.kind == KIND_PRE_DEADLINE,
                )
                .all()
            )
        }

        members = (
            db.query(TontineMembership.id, TontineMembership.user_id, User.name)
            .join(User, User.id == TontineMembership.user_id)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(True),
            )
            .all()
        )

        due_user_ids: list[int] = []
        for membership_id, user_id, _name in members:
            if cycle.payout_member_id and user_id == cycle.payout_member_id:
                continue
            if membership_id in paid_membership_ids:
                continue
            if user_id in already_notified_user_ids:
                continue
            due_user_ids.append(user_id)

        if not due_user_ids:
            continue

        subs: list[PushSubscription] = []
        subs_by_user: dict[int, list[PushSubscription]] = {}
        if web_push_configured:
            subs = (
                db.query(PushSubscription)
                .filter(
                    PushSubscription.is_active.is_(True),
                    PushSubscription.user_id.in_(due_user_ids),
                )
                .all()
            )
            for s in subs:
                subs_by_user.setdefault(s.user_id, []).append(s)

        mobile_devices = (
            db.query(MobilePushDevice)
            .filter(
                MobilePushDevice.is_active.is_(True),
                MobilePushDevice.user_id.in_(due_user_ids),
            )
            .all()
        )
        mobile_devices_by_user: dict[int, list[MobilePushDevice]] = {}
        for device in mobile_devices:
            mobile_devices_by_user.setdefault(device.user_id, []).append(device)

        deadline = cycle.contribution_deadline or cycle.end_date
        if deadline is None:
            continue

        hours_remaining = int(max(0, (deadline - current_time).total_seconds() // 3600))
        if hours_remaining <= 24 and deadline.date() == current_time.date():
            body_text = f"{tontine.name} \u2022 Cycle {cycle.cycle_number}: your contribution is due today."
        elif hours_remaining <= 24:
            body_text = f"{tontine.name} \u2022 Cycle {cycle.cycle_number}: due in {hours_remaining}h."
        else:
            body_text = f"{tontine.name} \u2022 Cycle {cycle.cycle_number} is due soon."

        for user_id in due_user_ids:
            user_subs = subs_by_user.get(user_id) or []
            if not user_subs:
                user_subs = []
            user_mobile_devices = mobile_devices_by_user.get(user_id) or []
            if not user_subs and not user_mobile_devices:
                continue

            targets += 1
            url = f"{settings.FRONTEND_URL.rstrip('/')}/tontines/{tontine.id}/cycles/{cycle.id}"
            payload = {
                "title": "Contribution reminder",
                "body": body_text,
                "tag": f"pre_deadline_cycle_{cycle.id}",
                "data": {"url": url, "cycle_id": cycle.id, "tontine_id": tontine.id},
            }

            any_sent = False
            for s in user_subs:
                subscriptions_used += 1
                if web_push_configured:
                    outcome = send_web_push(
                        endpoint=s.endpoint,
                        p256dh=s.p256dh,
                        auth=s.auth,
                        payload=payload,
                    )
                    if outcome.sent:
                        any_sent = True
                        push_sent += 1
                    else:
                        push_failed += 1
                        if outcome.is_gone:
                            s.is_active = False
                            subscriptions_deactivated += 1

            native_result = send_native_push_notifications(
                expo_push_tokens=[device.expo_push_token for device in user_mobile_devices],
                title=payload["title"],
                body=payload["body"],
                data=payload["data"],
            )
            mobile_devices_used += len(user_mobile_devices)
            native_push_sent += native_result.sent
            native_push_failed += native_result.failed
            if native_result.sent:
                any_sent = True
            if native_result.unregistered_tokens:
                for device in user_mobile_devices:
                    if device.expo_push_token in native_result.unregistered_tokens:
                        device.is_active = False
                        mobile_devices_deactivated += 1

            if any_sent:
                try:
                    db.add(PushNotificationLog(user_id=user_id, cycle_id=cycle.id, kind=KIND_PRE_DEADLINE))
                    db.commit()
                except Exception:
                    db.rollback()

        db.commit()

    return {
        "web_push_configured": web_push_configured,
        "cycles_checked": len(cycles),
        "targets": targets,
        "subscriptions_used": subscriptions_used,
        "push_sent": push_sent,
        "push_failed": push_failed,
        "subscriptions_deactivated": subscriptions_deactivated,
        "mobile_devices_used": mobile_devices_used,
        "native_push_sent": native_push_sent,
        "native_push_failed": native_push_failed,
        "mobile_devices_deactivated": mobile_devices_deactivated,
    }
