import base64
import hashlib
import hmac
import time
from typing import Any, Dict, Optional

import requests

from app.core.config import settings


class FlutterwaveService:
    OAUTH_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"
    BASE_V4 = "https://developersandbox-api.flutterwave.com"

    _access_token: Optional[str] = None
    _access_token_expires_at: float = 0.0

    @staticmethod
    def _ensure_oauth_credentials() -> None:
        if not settings.FLW_CLIENT_ID:
            raise ValueError("Missing FLW_CLIENT_ID")
        if not settings.FLW_CLIENT_SECRET:
            raise ValueError("Missing FLW_CLIENT_SECRET")

    @staticmethod
    def _get_access_token() -> str:
        now = time.time()
        if FlutterwaveService._access_token and now < FlutterwaveService._access_token_expires_at:
            return FlutterwaveService._access_token

        FlutterwaveService._ensure_oauth_credentials()
        resp = requests.post(
            FlutterwaveService.OAUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.FLW_CLIENT_ID,
                "client_secret": settings.FLW_CLIENT_SECRET,
            },
            timeout=30,
        )
        if not resp.ok:
            raise requests.HTTPError(
                f"Flutterwave OAuth token failed ({resp.status_code}): {resp.text}",
                response=resp,
            )

        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in", 300))
        if not token:
            raise ValueError("Flutterwave OAuth token response missing access_token")

        FlutterwaveService._access_token = token
        FlutterwaveService._access_token_expires_at = now + max(60, expires_in - 30)
        return token

    @staticmethod
    def _v4_request(
        *,
        method: str,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        token = FlutterwaveService._get_access_token()
        url = f"{FlutterwaveService.BASE_V4}{path}"
        resp = requests.request(
            method=method.upper(),
            url=url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=json_body,
            timeout=30,
        )
        if not resp.ok:
            raise requests.HTTPError(
                f"Flutterwave v4 {method.upper()} {path} failed ({resp.status_code}): {resp.text}",
                response=resp,
            )
        return resp.json()

    @staticmethod
    def find_customer_by_email(*, email: str) -> Optional[Dict[str, Any]]:
        page = 1
        while True:
            result = FlutterwaveService._v4_request(method="GET", path=f"/customers?page={page}")
            customers = result.get("data") or []
            for item in customers:
                if str(item.get("email") or "").strip().lower() == email.strip().lower():
                    return item

            page_info = (result.get("meta") or {}).get("page_info") or {}
            total_pages = int(page_info.get("total_pages") or 0)
            if total_pages <= 0 or page >= total_pages:
                break
            page += 1
        return None

    @staticmethod
    def create_customer(*, email: str, first_name: str = "", last_name: str = "", phone_number: str = "") -> Dict[str, Any]:
        payload: Dict[str, Any] = {"email": email}
        if first_name:
            payload["first_name"] = first_name
        if last_name:
            payload["last_name"] = last_name
        if phone_number:
            payload["phone_number"] = phone_number
        try:
            return FlutterwaveService._v4_request(method="POST", path="/customers", json_body=payload)
        except requests.HTTPError as exc:
            # Idempotency path for repeated runs with same customer email.
            if exc.response is not None and exc.response.status_code == 409:
                existing = FlutterwaveService.find_customer_by_email(email=email)
                if existing:
                    return {
                        "status": "success",
                        "message": "Customer fetched",
                        "data": existing,
                    }
            raise

    @staticmethod
    def create_mobile_money_payment_method(*, network: str, phone_number: str, country_code: str = "237") -> Dict[str, Any]:
        payload = {
            "type": "mobile_money",
            "mobile_money": {
                "network": network.lower(),
                "phone_number": phone_number,
                "country_code": country_code,
            },
        }
        return FlutterwaveService._v4_request(method="POST", path="/payment-methods", json_body=payload)

    @staticmethod
    def create_charge(
        *,
        reference: str,
        customer_id: str,
        payment_method_id: str,
        amount: str,
        currency: str = "XAF",
    ) -> Dict[str, Any]:
        payload = {
            "reference": reference,
            "customer_id": customer_id,
            "payment_method_id": payment_method_id,
            "currency": currency,
            "amount": float(amount),
        }
        return FlutterwaveService._v4_request(method="POST", path="/charges", json_body=payload)

    @staticmethod
    def get_charge(*, charge_id: str) -> Dict[str, Any]:
        return FlutterwaveService._v4_request(method="GET", path=f"/charges/{charge_id}")

    @staticmethod
    def verify_webhook_signature(*, raw_body: bytes, signature: str) -> bool:
        if not settings.FLW_SECRET_HASH or not signature:
            return False

        secret_hash = settings.FLW_SECRET_HASH.encode("utf-8")
        computed_digest = hmac.new(secret_hash, raw_body, hashlib.sha256).digest()
        computed_b64 = base64.b64encode(computed_digest).decode("utf-8")
        computed_hex = computed_digest.hex()
        candidate = signature.strip()
        return (
            hmac.compare_digest(candidate, computed_b64)
            or hmac.compare_digest(candidate, computed_hex)
            or hmac.compare_digest(candidate, settings.FLW_SECRET_HASH)
        )
