from __future__ import annotations

from dataclasses import dataclass

import requests


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_BATCH_SIZE = 100


@dataclass(frozen=True)
class NativePushSendResult:
    sent: int
    failed: int
    unregistered_tokens: list[str]


def is_valid_expo_push_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


def send_native_push_notifications(
    *,
    expo_push_tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> NativePushSendResult:
    valid_tokens = list(dict.fromkeys(t.strip() for t in expo_push_tokens if t and is_valid_expo_push_token(t.strip())))
    if not valid_tokens:
        return NativePushSendResult(sent=0, failed=0, unregistered_tokens=[])

    sent = 0
    failed = 0
    unregistered_tokens: list[str] = []

    for batch_start in range(0, len(valid_tokens), MAX_BATCH_SIZE):
        batch = valid_tokens[batch_start : batch_start + MAX_BATCH_SIZE]
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                "priority": "high",
                "channelId": "default",
            }
            for token in batch
        ]
        try:
            response = requests.post(
                EXPO_PUSH_URL,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                json=messages,
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            ticket_data = payload.get("data") or []
            if not isinstance(ticket_data, list):
                failed += len(batch)
                continue

            for token, ticket in zip(batch, ticket_data):
                status = ticket.get("status")
                if status == "ok":
                    sent += 1
                    continue

                failed += 1
                details = ticket.get("details") or {}
                if details.get("error") == "DeviceNotRegistered":
                    unregistered_tokens.append(token)

            if len(ticket_data) < len(batch):
                failed += len(batch) - len(ticket_data)
        except Exception:
            failed += len(batch)

    return NativePushSendResult(
        sent=sent,
        failed=failed,
        unregistered_tokens=list(dict.fromkeys(unregistered_tokens)),
    )
