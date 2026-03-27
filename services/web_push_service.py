import json
from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class WebPushSendOutcome:
    sent: bool
    is_gone: bool
    error: str | None = None


def web_push_is_configured() -> bool:
    return bool(settings.WEB_PUSH_VAPID_PRIVATE_KEY and settings.WEB_PUSH_VAPID_SUBJECT)


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    payload: dict,
) -> WebPushSendOutcome:
    """
    Send a single Web Push message.

    Notes:
    - Requires `pywebpush` dependency.
    - `endpoint`, `p256dh`, `auth` are from the browser's PushSubscription.
    """
    if not web_push_is_configured():
        return WebPushSendOutcome(sent=False, is_gone=False, error="Web Push is not configured")

    try:
        from pywebpush import WebPushException, webpush  # type: ignore
    except Exception as exc:  # pragma: no cover
        return WebPushSendOutcome(
            sent=False,
            is_gone=False,
            error=f"pywebpush is not installed: {exc}",
        )

    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
        )
        return WebPushSendOutcome(sent=True, is_gone=False)
    except WebPushException as exc:  # type: ignore
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        is_gone = status_code in {404, 410}
        return WebPushSendOutcome(
            sent=False,
            is_gone=is_gone,
            error=str(exc),
        )
    except Exception as exc:  # pragma: no cover
        return WebPushSendOutcome(sent=False, is_gone=False, error=str(exc))

