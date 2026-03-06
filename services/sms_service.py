from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.config import settings


class SMSService:
    """Twilio SMS helper."""

    @staticmethod
    def is_configured() -> bool:
        return all(
            [
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
                settings.TWILIO_FROM_NUMBER,
            ]
        )

    @staticmethod
    def send_sms(to_phone: str, message: str) -> str:
        """
        Send an SMS message and return Twilio message SID.
        Raises ValueError for local validation/config errors and RuntimeError for Twilio API errors.
        """
        if not SMSService.is_configured():
            raise ValueError(
                "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."
            )

        to_phone = to_phone.strip()
        message = message.strip()

        if not to_phone:
            raise ValueError("Recipient phone number is required.")
        if not message:
            raise ValueError("Message body is required.")

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        try:
            twilio_message = client.messages.create(
                body=message,
                from_=settings.TWILIO_FROM_NUMBER,
                to=to_phone,
            )
            return twilio_message.sid
        except TwilioRestException as exc:
            raise RuntimeError(f"Twilio SMS send failed: {exc.msg}") from exc
