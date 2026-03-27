from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.mobile_push_device import MobilePushDevice
from app.models.push_subscription import PushSubscription
from app.services.native_push_service import send_native_push_notifications
from app.services.web_push_service import send_web_push, web_push_is_configured


def send_web_push_to_users(
    db: Session,
    *,
    user_ids: list[int],
    title: str,
    body: str,
    url: str,
    tag: str,
    data: dict | None = None,
) -> dict:
    """
    Best-effort push broadcast to a set of users.

    - Sends to browser Web Push subscriptions when configured.
    - Sends to native mobile Expo push tokens when present.
    - No dedupe log here (these events are usually one-shot, transactional).
    - Deactivates gone subscriptions/tokens when the provider says they are stale.
    """
    if not user_ids:
        return {
            "configured": web_push_is_configured(),
            "sent": 0,
            "failed": 0,
            "subscriptions": 0,
            "web_subscriptions": 0,
            "mobile_devices": 0,
            "web_sent": 0,
            "web_failed": 0,
            "native_sent": 0,
            "native_failed": 0,
        }

    subs: list[PushSubscription] = []
    subs_by_user: dict[int, list[PushSubscription]] = defaultdict(list)
    if web_push_is_configured():
        subs = (
            db.query(PushSubscription)
            .filter(
                PushSubscription.is_active.is_(True),
                PushSubscription.user_id.in_(user_ids),
            )
            .all()
        )
        for s in subs:
            subs_by_user[s.user_id].append(s)

    mobile_devices = (
        db.query(MobilePushDevice)
        .filter(
            MobilePushDevice.is_active.is_(True),
            MobilePushDevice.user_id.in_(user_ids),
        )
        .all()
    )

    payload = {
        "title": title,
        "body": body,
        "tag": tag,
        "data": {"url": url, **(data or {})},
    }

    sent = 0
    failed = 0
    for uid in user_ids:
        for s in subs_by_user.get(uid, []):
            outcome = send_web_push(
                endpoint=s.endpoint,
                p256dh=s.p256dh,
                auth=s.auth,
                payload=payload,
            )
            if outcome.sent:
                sent += 1
            else:
                failed += 1
                if outcome.is_gone:
                    s.is_active = False

    native_result = send_native_push_notifications(
        expo_push_tokens=[device.expo_push_token for device in mobile_devices],
        title=title,
        body=body,
        data={"url": url, **(data or {})},
    )
    sent += native_result.sent
    failed += native_result.failed
    if native_result.unregistered_tokens:
        for device in mobile_devices:
            if device.expo_push_token in native_result.unregistered_tokens:
                device.is_active = False

    db.commit()
    return {
        "configured": web_push_is_configured() or bool(mobile_devices),
        "sent": sent,
        "failed": failed,
        "subscriptions": len(subs) + len(mobile_devices),
        "web_subscriptions": len(subs),
        "mobile_devices": len(mobile_devices),
        "web_sent": sent - native_result.sent,
        "web_failed": failed - native_result.failed,
        "native_sent": native_result.sent,
        "native_failed": native_result.failed,
    }


def send_web_push_to_user(
    db: Session,
    *,
    user_id: int,
    title: str,
    body: str,
    url: str,
    tag: str,
    data: dict | None = None,
) -> dict:
    return send_web_push_to_users(
        db,
        user_ids=[user_id],
        title=title,
        body=body,
        url=url,
        tag=tag,
        data=data,
    )
