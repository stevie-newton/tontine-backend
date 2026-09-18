"""Run with python -m unittest discover -s tests -p test_contribution_proofs.py.

All storage is mocked and all databases are in-memory SQLite. No live services.
"""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure loading app.core.database cannot connect to production in this process.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["AUTO_RUN_MIGRATIONS"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.dependencies import get_current_user
from app.core.i18n import translate_detail
from app.core.proof_upload_route import ProofUploadRoute
from app.models.contribution import Contribution
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.transaction_ledger import TransactionLedger
from app.models.user import User
from app.routes.contribution import router
from app.services.contribution_proof_service import ContributionProofService as Proofs


def png_bytes(size=(80, 120)):
    output = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("private-note", "sensitive metadata")
    Image.new("RGBA", size, (30, 60, 100, 255)).save(output, "PNG", pnginfo=metadata)
    return output.getvalue()


class ImageValidationTests(unittest.TestCase):
    def test_upload_errors_are_localized_without_changing_english(self):
        message = "Payment screenshot must be 5 MB or smaller"
        self.assertEqual(translate_detail(message, "fr"), "La capture du paiement doit faire 5 Mo maximum")
        self.assertEqual(translate_detail(message, "en"), message)
        self.assertEqual(
            translate_detail("Transaction reference is required", "fr"),
            "La référence de la transaction est obligatoire",
        )

    def test_normalizes_to_jpeg_without_metadata(self):
        image = Proofs.normalize_image(BytesIO(png_bytes((2500, 100))), "image/png")
        with Image.open(BytesIO(image)) as decoded:
            self.assertEqual(decoded.format, "JPEG")
            self.assertLessEqual(max(decoded.size), 2400)
            self.assertNotIn("private-note", decoded.info)
            self.assertNotIn("exif", decoded.info)
        self.assertNotIn(b"sensitive metadata", image)

    def test_rejects_oversize_empty_invalid_and_mislabeled_files(self):
        cases = [
            (b"x" * (Proofs.MAX_BYTES + 1), "image/png", 413),
            (b"", "image/png", 422),
            (b"<script>alert(1)</script>", "image/png", 422),
            (png_bytes(), "image/jpeg", 415),
            (png_bytes(), "image/svg+xml", 415),
        ]
        for data, content_type, status in cases:
            with self.subTest(content_type=content_type, expected=status):
                with self.assertRaises(HTTPException) as error:
                    Proofs.normalize_image(BytesIO(data), content_type)
                self.assertEqual(error.exception.status_code, status)

    def test_pixel_limit_is_checked_before_decoding(self):
        with patch.object(Proofs, "MAX_PIXELS", 100):
            with self.assertRaises(HTTPException) as error:
                Proofs.normalize_image(BytesIO(png_bytes()), "image/png")
        self.assertEqual(error.exception.status_code, 422)


class ContributionProofTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.users = {}
        for index, name in enumerate(("contributor", "beneficiary", "other", "owner", "outsider"), 1):
            user = User(id=index, name=name, phone=f"+1555000000{index}", hashed_password="unused", is_global_admin=name == "owner")
            self.db.add(user)
            self.users[name] = user
        self.db.flush()
        self.tontine = Tontine(id=1, name="Test group", contribution_amount=Decimal("100.00"), frequency="monthly", total_cycles=3, current_cycle=1, status=TontineStatus.ACTIVE, owner_id=4)
        self.db.add(self.tontine)
        self.db.flush()
        self.memberships = {}
        for name in ("contributor", "beneficiary", "other", "owner"):
            membership = TontineMembership(user_id=self.users[name].id, tontine_id=1, is_active=True, role="admin" if name == "owner" else "member")
            self.db.add(membership)
            self.memberships[name] = membership
        now = datetime.now(timezone.utc)
        self.cycle = TontineCycle(id=1, tontine_id=1, cycle_number=1, payout_member_id=2, start_date=now, end_date=now + timedelta(days=30), is_closed=False)
        self.db.add(self.cycle)
        self.db.commit()
        self.s3 = MagicMock()
        self.image = Proofs.normalize_image(BytesIO(png_bytes()), "image/png")
        self.s3.get_object.side_effect = lambda **kwargs: {"Body": BytesIO(self.image)}
        for attr, value in {
            "PROOF_UPLOAD_ENABLED": True,
            "PROOF_STORAGE_BUCKET": "private-test-bucket",
            "PROOF_STORAGE_ENDPOINT_URL": "https://example.invalid",
            "PROOF_STORAGE_ACCESS_KEY_ID": "",
            "PROOF_STORAGE_SECRET_ACCESS_KEY": "",
            "PROOF_STORAGE_SERVER_SIDE_ENCRYPTION": "",
        }.items():
            patcher = patch.object(settings, attr, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        storage = patch.object(Proofs, "_client", return_value=self.s3)
        storage.start()
        self.addCleanup(storage.stop)
        notify = patch("app.services.contribution_service.send_web_push_to_user")
        notify.start()
        self.addCleanup(notify.stop)
        app = FastAPI()
        app.include_router(router)

        def override_db():
            yield self.db

        def override_user(request: Request):
            name = request.headers.get("X-Test-User")
            if name not in self.users:
                raise HTTPException(status_code=401, detail="Not authenticated")
            return self.users[name]

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def submit(self, user="contributor", **changes):
        fields = {"cycle_id": "1", "amount": "100.00", "transaction_reference": " TRANSFER-001 "}
        fields.update(changes)
        return self.client.post("/contributions/with-proof", data=fields, files={"proof": ("proof.png", png_bytes(), "image/png")}, headers={"X-Test-User": user})

    def test_multipart_creates_private_proof_and_remains_pending(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.text)
        result = response.json()
        self.assertTrue(result["proof_available"])
        self.assertIsNone(result["proof_screenshot_url"])
        self.assertNotIn("proof_storage_key", result)
        self.assertEqual(result["transaction_reference"], "TRANSFER-001")
        self.assertFalse(result["is_confirmed"])
        self.assertFalse(result["ledger_entry_created"])
        self.assertEqual(result["beneficiary_decision"], "pending")
        self.assertEqual(self.db.query(TransactionLedger).count(), 0)
        stored = self.db.query(Contribution).one()
        self.assertRegex(stored.proof_storage_key, Proofs.KEY_PATTERN)
        put = self.s3.put_object.call_args.kwargs
        self.assertEqual(put["Key"], stored.proof_storage_key)
        self.assertEqual(put["ContentType"], "image/jpeg")
        self.assertEqual(put["CacheControl"], "private, no-store")
        self.assertNotIn("ACL", put)
        listed = self.client.get("/contributions/cycle/1", headers={"X-Test-User": "beneficiary"})
        self.assertTrue(listed.json()["contributions"][0]["proof_available"])
        self.assertNotIn(stored.proof_storage_key, listed.text)
        personal = self.client.get("/contributions/my/1", headers={"X-Test-User": "contributor"})
        self.assertEqual(personal.status_code, 200, personal.text)
        self.assertTrue(personal.json()[0]["proof_available"])

    def test_json_submission_works_when_proofs_are_disabled(self):
        with patch.object(settings, "PROOF_UPLOAD_ENABLED", False):
            response = self.client.post("/contributions/", json={"cycle_id": 1, "amount": "100.00", "transaction_reference": "legacy-ref", "proof_screenshot_url": "https://example.invalid/legacy-proof.png"}, headers={"X-Test-User": "contributor"})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertFalse(response.json()["proof_available"])
        self.assertEqual(response.json()["proof_screenshot_url"], "https://example.invalid/legacy-proof.png")
        self.s3.put_object.assert_not_called()

    def test_empty_reference_never_creates_contribution(self):
        for value in ("", "  "):
            response = self.submit(transaction_reference=value)
            self.assertEqual(response.status_code, 422, response.text)
        response = self.client.post("/contributions/", json={"cycle_id": 1, "amount": "100.00", "transaction_reference": "   "}, headers={"X-Test-User": "contributor"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.query(Contribution).count(), 0)
        self.s3.put_object.assert_not_called()

    def test_membership_cycle_amount_and_duplicates_checked_before_upload(self):
        for user, changes, expected in [("outsider", {}, 403), ("beneficiary", {}, 403), ("contributor", {"amount": "99.00"}, 400), ("contributor", {"cycle_id": "999"}, 404)]:
            response = self.submit(user=user, **changes)
            self.assertEqual(response.status_code, expected, response.text)
        self.s3.put_object.assert_not_called()
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(self.submit().status_code, 409)
        self.s3.put_object.assert_called_once()
        self.assertEqual(self.db.query(Contribution).count(), 1)

    def test_storage_failure_leaves_no_contribution(self):
        self.s3.put_object.side_effect = RuntimeError("storage unavailable")
        self.assertEqual(self.submit().status_code, 503)
        self.assertEqual(self.db.query(Contribution).count(), 0)
        self.s3.delete_object.assert_called_once()

    def test_failed_flush_cleans_up_uploaded_object(self):
        original_flush = self.db.flush
        def fail_contribution_flush(*args, **kwargs):
            if any(isinstance(item, Contribution) for item in self.db.new):
                raise SQLAlchemyError("flush failed")
            return original_flush(*args, **kwargs)
        with patch.object(self.db, "flush", side_effect=fail_contribution_flush):
            self.assertEqual(self.submit().status_code, 500)
        self.assertEqual(self.db.query(Contribution).count(), 0)
        self.s3.delete_object.assert_called_once()

    def test_commit_acknowledgement_failure_retains_proof(self):
        original_commit = self.db.commit
        def commit_then_disconnect():
            original_commit()
            raise SQLAlchemyError("commit acknowledgement lost")
        with patch.object(self.db, "commit", side_effect=commit_then_disconnect):
            self.assertEqual(self.submit().status_code, 500)
        self.assertEqual(self.db.query(Contribution).count(), 1)
        self.s3.delete_object.assert_not_called()

    def test_post_commit_refresh_failure_keeps_stored_proof(self):
        with patch.object(self.db, "refresh", side_effect=SQLAlchemyError("refresh failed")):
            self.assertEqual(self.submit().status_code, 500)
        self.assertEqual(self.db.query(Contribution).count(), 1)
        self.s3.delete_object.assert_not_called()

    def test_read_requires_active_contributor_or_active_beneficiary(self):
        contribution_id = self.submit().json()["id"]
        url = f"/contributions/{contribution_id}/proof"
        for name in ("contributor", "beneficiary"):
            response = self.client.get(url, headers={"X-Test-User": name})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["content-type"], "image/jpeg")
            self.assertIn("no-store", response.headers["cache-control"])
            self.assertEqual(response.content, self.image)
        self.s3.get_object.reset_mock()
        for name in ("other", "owner", "outsider"):
            self.assertEqual(self.client.get(url, headers={"X-Test-User": name}).status_code, 403)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.s3.get_object.assert_not_called()
        for name in ("contributor", "beneficiary"):
            self.memberships[name].is_active = False
        self.db.commit()
        for name in ("contributor", "beneficiary"):
            self.assertEqual(self.client.get(url, headers={"X-Test-User": name}).status_code, 403)

    def test_capability_is_authenticated_and_disabled_without_storage(self):
        self.assertEqual(self.client.get("/contributions/proof-upload/status").status_code, 401)
        headers = {"X-Test-User": "contributor"}
        self.assertEqual(self.client.get("/contributions/proof-upload/status", headers=headers).json(), {"available": True, "max_bytes": 5242880})
        with patch.object(settings, "PROOF_STORAGE_BUCKET", ""):
            self.assertFalse(self.client.get("/contributions/proof-upload/status", headers=headers).json()["available"])
            self.assertEqual(self.submit().status_code, 503)
        self.assertEqual(self.db.query(Contribution).count(), 0)

    def test_complete_multipart_request_is_bounded(self):
        response = self.client.post("/contributions/with-proof", content=b"x" * (ProofUploadRoute.MAX_REQUEST_BYTES + 1), headers={"Content-Type": "multipart/form-data; boundary=test", "X-Test-User": "contributor"})
        self.assertEqual(response.status_code, 413)
        self.s3.put_object.assert_not_called()

    def test_disabled_uploads_keep_existing_proof_readable(self):
        contribution_id = self.submit().json()["id"]
        with patch.object(settings, "PROOF_UPLOAD_ENABLED", False):
            response = self.client.get(f"/contributions/{contribution_id}/proof", headers={"X-Test-User": "beneficiary"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.submit(user="other").status_code, 503)


if __name__ == "__main__":
    unittest.main()
