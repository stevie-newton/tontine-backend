from app.core.rate_limit import reset_rate_limit_state
from app.core.security import hash_password
from app.models.user import User


def test_login_rate_limit_blocks_after_five_failed_attempts(client, db_session):
    reset_rate_limit_state()
    user = User(name="Rate User", phone="+237670000111", hashed_password=hash_password("CorrectPass123"))
    db_session.add(user)
    db_session.commit()

    for _ in range(5):
        r = client.post(
            "/auth/login",
            data={"username": user.phone, "password": "wrong-pass"},
            headers={"x-forwarded-for": "203.0.113.10"},
        )
        assert r.status_code == 401

    blocked = client.post(
        "/auth/login",
        data={"username": user.phone, "password": "wrong-pass"},
        headers={"x-forwarded-for": "203.0.113.10"},
    )
    assert blocked.status_code == 429


def test_login_success_clears_failed_attempts_for_ip(client, db_session):
    reset_rate_limit_state()
    user = User(name="Rate User 2", phone="+237670000222", hashed_password=hash_password("CorrectPass123"))
    db_session.add(user)
    db_session.commit()

    # Build some failed attempts.
    for _ in range(4):
        r = client.post(
            "/auth/login",
            data={"username": user.phone, "password": "bad"},
            headers={"x-forwarded-for": "203.0.113.20"},
        )
        assert r.status_code == 401

    ok = client.post(
        "/auth/login",
        data={"username": user.phone, "password": "CorrectPass123"},
        headers={"x-forwarded-for": "203.0.113.20"},
    )
    assert ok.status_code == 200

    # Counter is cleared on success, so failures restart from zero.
    again = client.post(
        "/auth/login",
        data={"username": user.phone, "password": "bad"},
        headers={"x-forwarded-for": "203.0.113.20"},
    )
    assert again.status_code == 401
