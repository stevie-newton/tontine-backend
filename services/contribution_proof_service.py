"""Private contribution images: validate bytes, store privately, authorize every read."""
from __future__ import annotations

import logging
import re
import uuid
import warnings
from io import BytesIO
from typing import BinaryIO
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.contribution import Contribution
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User

logger = logging.getLogger(__name__)


class ContributionProofService:
    MAX_BYTES = 5 * 1024 * 1024
    MAX_PIXELS = 20_000_000
    MAX_DIMENSION = 12_000
    KEY_PATTERN = re.compile(r"^contribution-proofs/[a-f0-9]{32}\.jpg$")

    @staticmethod
    def configured() -> bool:
        endpoint = settings.PROOF_STORAGE_ENDPOINT_URL
        return bool(
            settings.PROOF_STORAGE_BUCKET
            and (not endpoint or urlparse(endpoint).scheme == "https")
            and bool(settings.PROOF_STORAGE_ACCESS_KEY_ID) == bool(settings.PROOF_STORAGE_SECRET_ACCESS_KEY)
        )

    @staticmethod
    def available() -> bool:
        return settings.PROOF_UPLOAD_ENABLED and ContributionProofService.configured()

    @staticmethod
    def _client():
        if not ContributionProofService.configured():
            raise HTTPException(status_code=503, detail="Payment proof uploads are not available yet. You can submit with a transaction reference only.")
        # Lazy imports keep the existing JSON contribution flow independent from
        # storage when uploads are disabled during rollout.
        import boto3
        from botocore.config import Config

        options = {
            "region_name": settings.PROOF_STORAGE_REGION,
            "config": Config(
                connect_timeout=5,
                read_timeout=15,
                retries={"max_attempts": 2, "mode": "standard"},
                signature_version="s3v4",
            ),
        }
        if settings.PROOF_STORAGE_ENDPOINT_URL:
            options["endpoint_url"] = settings.PROOF_STORAGE_ENDPOINT_URL
        if settings.PROOF_STORAGE_ACCESS_KEY_ID:
            options["aws_access_key_id"] = settings.PROOF_STORAGE_ACCESS_KEY_ID
            options["aws_secret_access_key"] = settings.PROOF_STORAGE_SECRET_ACCESS_KEY
        return boto3.client("s3", **options)

    @staticmethod
    def normalize_image(file: BinaryIO, content_type: str | None) -> bytes:
        """Decode only PNG/JPEG; discard metadata and encode a bounded JPEG."""
        from PIL import Image, ImageOps, UnidentifiedImageError

        if content_type not in {"image/jpeg", "image/png"}:
            raise HTTPException(status_code=415, detail="Choose a JPEG or PNG payment screenshot")
        raw = file.read(ContributionProofService.MAX_BYTES + 1)
        if len(raw) > ContributionProofService.MAX_BYTES:
            raise HTTPException(status_code=413, detail="Payment screenshot must be 5 MB or smaller")
        if not raw:
            raise HTTPException(status_code=422, detail="Payment screenshot is empty")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(raw), formats=("PNG", "JPEG")) as source:
                    expected = "PNG" if content_type == "image/png" else "JPEG"
                    if source.format != expected:
                        raise HTTPException(status_code=415, detail="Screenshot contents do not match the image type")
                    width, height = source.size
                    if (
                        width * height > ContributionProofService.MAX_PIXELS
                        or max(width, height) > ContributionProofService.MAX_DIMENSION
                        or getattr(source, "n_frames", 1) != 1
                    ):
                        raise HTTPException(status_code=422, detail="Choose a single screenshot with smaller dimensions")
                    source.verify()
                with Image.open(BytesIO(raw), formats=("PNG", "JPEG")) as source:
                    source.load()
                    oriented = ImageOps.exif_transpose(source)
                    oriented.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
                    # A fresh image strips EXIF, GPS, comments, and PNG text.
                    clean = Image.new("RGB", oriented.size, "white")
                    if "A" in oriented.getbands() or "transparency" in oriented.info:
                        rgba = oriented.convert("RGBA")
                        clean.paste(rgba, mask=rgba.getchannel("A"))
                    else:
                        clean.paste(oriented.convert("RGB"))
                    output = BytesIO()
                    clean.save(output, format="JPEG", quality=90, subsampling=0)
                    result = output.getvalue()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
                Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise HTTPException(status_code=422, detail="This screenshot could not be read. Choose a valid JPEG or PNG image.") from None
        if len(result) > ContributionProofService.MAX_BYTES:
            raise HTTPException(status_code=413, detail="Payment screenshot must be 5 MB or smaller after processing")
        return result

    @staticmethod
    def store(image: bytes) -> str:
        if not ContributionProofService.available():
            raise HTTPException(status_code=503, detail="Payment proof uploads are not available yet. You can submit with a transaction reference only.")
        key = f"contribution-proofs/{uuid.uuid4().hex}.jpg"
        try:
            client = ContributionProofService._client()
            options = {}
            if settings.PROOF_STORAGE_SERVER_SIDE_ENCRYPTION:
                options["ServerSideEncryption"] = settings.PROOF_STORAGE_SERVER_SIDE_ENCRYPTION
            client.put_object(
                Bucket=settings.PROOF_STORAGE_BUCKET,
                Key=key,
                Body=image,
                ContentType="image/jpeg",
                CacheControl="private, no-store",
                # No ACL override: bucket must be private with public access blocked.
                **options,
            )
            return key
        except HTTPException:
            raise
        except Exception:
            # A timed-out PUT may have succeeded on the object store.
            ContributionProofService.delete_best_effort(key)
            logger.warning("Payment proof storage failed", exc_info=True)
            raise HTTPException(status_code=503, detail="Payment screenshot could not be uploaded. Please try again.") from None

    @staticmethod
    def delete_best_effort(key: str) -> None:
        if not ContributionProofService.KEY_PATTERN.fullmatch(key):
            return
        try:
            ContributionProofService._client().delete_object(Bucket=settings.PROOF_STORAGE_BUCKET, Key=key)
        except Exception:
            # Operations can reconcile this opaque key against live DB records.
            logger.warning("Private proof cleanup required for key %s", key, exc_info=True)

    @staticmethod
    def read_authorized(db: Session, contribution_id: int, current_user: User) -> bytes:
        contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
        if contribution is None:
            raise HTTPException(status_code=404, detail="Contribution not found")
        membership = db.query(TontineMembership).filter(TontineMembership.id == contribution.membership_id).first()
        cycle = db.query(TontineCycle).filter(TontineCycle.id == contribution.cycle_id).first()
        if not membership or not cycle or membership.tontine_id != cycle.tontine_id:
            raise HTTPException(status_code=404, detail="Contribution not found")
        viewer_membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == cycle.tontine_id,
            TontineMembership.is_active.is_(True),
        ).first()
        if not viewer_membership or current_user.id not in {membership.user_id, cycle.payout_member_id}:
            raise HTTPException(status_code=403, detail="Only the contributor and cycle beneficiary can view this payment proof")
        key = contribution.proof_storage_key
        if not key or not ContributionProofService.KEY_PATTERN.fullmatch(key):
            raise HTTPException(status_code=404, detail="No payment screenshot is available")
        try:
            response = ContributionProofService._client().get_object(Bucket=settings.PROOF_STORAGE_BUCKET, Key=key)
            body = response["Body"]
            try:
                data = body.read(ContributionProofService.MAX_BYTES + 1)
            finally:
                body.close()
            if not data or len(data) > ContributionProofService.MAX_BYTES:
                raise ValueError("Invalid stored proof size")
            return data
        except HTTPException:
            raise
        except Exception:
            logger.warning("Payment proof could not be read", exc_info=True)
            raise HTTPException(status_code=503, detail="Payment screenshot is temporarily unavailable. Please try again.") from None
