import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailService:
    @staticmethod
    def is_configured() -> bool:
        return all(
            [
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                settings.SMTP_FROM_EMAIL,
                settings.SUPPORT_EMAIL_TO,
            ]
        )

    @staticmethod
    def send_support_ticket_email(subject: str, body: str) -> None:
        if not EmailService.is_configured():
            raise ValueError(
                "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_FROM_EMAIL, and SUPPORT_EMAIL_TO."
            )

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = settings.SUPPORT_EMAIL_TO
        msg.set_content(body)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
