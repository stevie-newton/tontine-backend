from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.mobile_push_device import MobilePushDevice
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.push import (
    MobilePushDeviceCreate,
    MobilePushStatusResponse,
    MobilePushSubscribeResponse,
    MobilePushUnsubscribeRequest,
    WebPushSubscribeResponse,
    WebPushSubscriptionCreate,
    WebPushTestResponse,
    WebPushUnsubscribeRequest,
)
from app.services.native_push_service import send_native_push_notifications
from app.services.web_push_service import send_web_push, web_push_is_configured

router = APIRouter(prefix="/push", tags=["push"])


@router.post("/subscribe", response_model=WebPushSubscribeResponse)
def subscribe_web_push(
    payload: WebPushSubscriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    endpoint = payload.endpoint.strip()
    now = datetime.now(timezone.utc)
    user_agent = request.headers.get("user-agent")

    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if not sub:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=user_agent,
            is_active=True,
            last_seen_at=now,
        )
        db.add(sub)
    else:
        sub.user_id = current_user.id
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
        sub.user_agent = user_agent
        sub.is_active = True
        sub.last_seen_at = now

    db.commit()
    return WebPushSubscribeResponse(subscribed=True)


@router.post("/unsubscribe")
def unsubscribe_web_push(
    payload: WebPushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    endpoint = payload.endpoint.strip()
    sub = (
        db.query(PushSubscription)
        .filter(
            PushSubscription.endpoint == endpoint,
            PushSubscription.user_id == current_user.id,
        )
        .first()
    )
    if sub:
        sub.is_active = False
        db.add(sub)
        db.commit()
    return {"unsubscribed": True}


@router.post("/mobile/subscribe", response_model=MobilePushSubscribeResponse)
def subscribe_mobile_push(
    payload: MobilePushDeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expo_push_token = payload.expo_push_token.strip()
    now = datetime.now(timezone.utc)

    device = (
        db.query(MobilePushDevice)
        .filter(MobilePushDevice.expo_push_token == expo_push_token)
        .first()
    )
    if not device:
        device = MobilePushDevice(
            user_id=current_user.id,
            expo_push_token=expo_push_token,
            platform=payload.platform,
            device_name=payload.device_name,
            app_version=payload.app_version,
            is_active=True,
            last_seen_at=now,
        )
        db.add(device)
    else:
        device.user_id = current_user.id
        device.platform = payload.platform
        device.device_name = payload.device_name
        device.app_version = payload.app_version
        device.is_active = True
        device.last_seen_at = now

    db.commit()
    return MobilePushSubscribeResponse(subscribed=True)


@router.post("/mobile/unsubscribe")
def unsubscribe_mobile_push(
    payload: MobilePushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expo_push_token = payload.expo_push_token.strip()
    device = (
        db.query(MobilePushDevice)
        .filter(
            MobilePushDevice.expo_push_token == expo_push_token,
            MobilePushDevice.user_id == current_user.id,
        )
        .first()
    )
    if device:
        device.is_active = False
        db.add(device)
        db.commit()
    return {"unsubscribed": True}


@router.get("/mobile/me", response_model=MobilePushStatusResponse)
def get_my_mobile_push_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    devices_count = (
        db.query(MobilePushDevice)
        .filter(
            MobilePushDevice.user_id == current_user.id,
            MobilePushDevice.is_active.is_(True),
        )
        .count()
    )
    return MobilePushStatusResponse(subscribed=devices_count > 0, devices=devices_count)


@router.post("/test", response_model=WebPushTestResponse)
def test_web_push(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subs: list[PushSubscription] = []
    if web_push_is_configured():
        subs = (
            db.query(PushSubscription)
            .filter(
                PushSubscription.user_id == current_user.id,
                PushSubscription.is_active.is_(True),
            )
            .all()
        )

    mobile_devices = (
        db.query(MobilePushDevice)
        .filter(
            MobilePushDevice.user_id == current_user.id,
            MobilePushDevice.is_active.is_(True),
        )
        .all()
    )
    if not subs and not mobile_devices:
        return WebPushTestResponse(
            subscriptions=0,
            sent=0,
            failed=0,
            web_subscriptions=0,
            mobile_devices=0,
        )

    sent = 0
    failed = 0
    web_sent = 0
    web_failed = 0
    payload = {
        "title": "Cercora",
        "body": "Test push notification",
        "tag": "test_push",
        "data": {"url": "/"},
    }
    for s in subs:
        outcome = send_web_push(
            endpoint=s.endpoint,
            p256dh=s.p256dh,
            auth=s.auth,
            payload=payload,
        )
        if outcome.sent:
            sent += 1
            web_sent += 1
        else:
            failed += 1
            web_failed += 1
            if outcome.is_gone:
                s.is_active = False
                db.add(s)

    native_result = send_native_push_notifications(
        expo_push_tokens=[device.expo_push_token for device in mobile_devices],
        title=payload["title"],
        body=payload["body"],
        data=payload["data"],
    )
    sent += native_result.sent
    failed += native_result.failed
    if native_result.unregistered_tokens:
        for device in mobile_devices:
            if device.expo_push_token in native_result.unregistered_tokens:
                device.is_active = False
                db.add(device)

    db.commit()
    return WebPushTestResponse(
        subscriptions=len(subs) + len(mobile_devices),
        sent=sent,
        failed=failed,
        web_subscriptions=len(subs),
        mobile_devices=len(mobile_devices),
    )
