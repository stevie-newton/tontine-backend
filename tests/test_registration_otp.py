from app.models.user import User


def test_register_creates_unverified_user_and_sends_otp(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routes.auth._generate_registration_otp_code", lambda: "123456")
    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: False))

    phone = "+237670001111"
    register = client.post(
        "/auth/register",
        json={"name": "No OTP", "phone": phone, "password": "pass1234"},
    )
    assert register.status_code == 200, register.text

    user = db_session.query(User).filter(User.phone == phone).first()
    assert user is not None
    assert user.is_phone_verified is False


def test_verify_phone_marks_user_verified(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routes.auth._generate_registration_otp_code", lambda: "123456")
    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: False))

    phone = "+237670001112"
    register = client.post(
        "/auth/register",
        json={"name": "OTP User", "phone": phone, "password": "pass1234"},
    )
    assert register.status_code == 200, register.text

    verify = client.post("/auth/verify-phone", json={"phone": phone, "code": "123456"})
    assert verify.status_code == 200, verify.text

    user = db_session.query(User).filter(User.phone == phone).first()
    assert user is not None
    assert user.is_phone_verified is True


def test_resend_otp_has_cooldown(client, monkeypatch):
    monkeypatch.setattr("app.routes.auth._generate_registration_otp_code", lambda: "123456")
    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: False))

    phone = "+237670001113"
    register = client.post(
        "/auth/register",
        json={"name": "Resend User", "phone": phone, "password": "pass1234"},
    )
    assert register.status_code == 200, register.text

    resend = client.post("/auth/resend-otp", json={"phone": phone})
    assert resend.status_code == 429, resend.text


def test_unverified_user_cannot_login(client, monkeypatch):
    monkeypatch.setattr("app.routes.auth._generate_registration_otp_code", lambda: "123456")
    monkeypatch.setattr("app.services.sms_service.SMSService.is_configured", staticmethod(lambda: False))

    phone = "+237670001114"
    register = client.post(
        "/auth/register",
        json={"name": "Login Block User", "phone": phone, "password": "pass1234"},
    )
    assert register.status_code == 200, register.text

    login = client.post("/auth/login", data={"username": phone, "password": "pass1234"})
    assert login.status_code == 403, login.text
    assert login.json()["detail"] == "Phone number is not verified"
