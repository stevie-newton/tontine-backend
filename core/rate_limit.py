from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import Request


_FAILED_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()


def _prune(ip: str, *, now_ts: float, window_seconds: int) -> None:
    attempts = _FAILED_ATTEMPTS[ip]
    threshold = now_ts - window_seconds
    while attempts and attempts[0] < threshold:
        attempts.popleft()
    if not attempts:
        _FAILED_ATTEMPTS.pop(ip, None)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def is_limited(ip: str, *, max_attempts: int, window_seconds: int) -> bool:
    now_ts = time()
    with _LOCK:
        _prune(ip, now_ts=now_ts, window_seconds=window_seconds)
        return len(_FAILED_ATTEMPTS.get(ip, ())) >= max_attempts


def record_failed_attempt(ip: str, *, window_seconds: int) -> None:
    now_ts = time()
    with _LOCK:
        _prune(ip, now_ts=now_ts, window_seconds=window_seconds)
        _FAILED_ATTEMPTS[ip].append(now_ts)


def clear_failed_attempts(ip: str) -> None:
    with _LOCK:
        _FAILED_ATTEMPTS.pop(ip, None)


def reset_rate_limit_state() -> None:
    with _LOCK:
        _FAILED_ATTEMPTS.clear()
