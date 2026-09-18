# Private payment screenshots

Phase 1 keeps the transaction reference required and allows one optional JPEG or
PNG screenshot (up to 5 MiB) at contribution submission. The contribution remains
pending until its beneficiary confirms it. Existing JSON clients remain supported.

## Enable the backend before shipping the mobile picker

1. Install the pinned backend requirements (`boto3==1.43.96`, `Pillow==12.3.0`).
2. Apply `alembic upgrade head`; the new revision is `e4b9a1d7c2f6`. The nullable
   `contributions.proof_storage_key` column must exist before deploying this code.
3. Create a **private** S3-compatible bucket with public access blocked, no public
   domain, and server-side encryption enabled. Never use a public website bucket.
   Grant the API service only PutObject, GetObject, and DeleteObject permissions
   for `contribution-proofs/*`. Do not put credentials in mobile environment files.
4. Configure backend-only variables:

   ```dotenv
   PROOF_UPLOAD_ENABLED=true
   PROOF_STORAGE_BUCKET=your-private-bucket
   PROOF_STORAGE_REGION=us-east-1
   # Optional for non-AWS S3 providers; must use HTTPS:
   PROOF_STORAGE_ENDPOINT_URL=https://your-provider-endpoint
   # Optional when an AWS IAM role supplies credentials:
   PROOF_STORAGE_ACCESS_KEY_ID=your-server-access-key
   PROOF_STORAGE_SECRET_ACCESS_KEY=your-server-secret
   # Optional explicit override if supported; otherwise bucket encryption applies:
   PROOF_STORAGE_SERVER_SIDE_ENCRYPTION=AES256
   ```

5. Test upload and authorized retrieval on a staging server. Setting the upload
   switch to false hides the mobile upload option and preserves existing proof
   reads while storage remains configured. Capability reports configuration, not
   a live health check; transient storage failures return a recoverable 503.

## API

- Authenticated `GET /contributions/proof-upload/status` returns
  `{"available": true, "max_bytes": 5242880}` when uploads are configured/enabled.
- `POST /contributions/with-proof` accepts multipart fields `cycle_id`, `amount`,
  `transaction_reference`, and file `proof`. The reference must be nonempty.
- Responses expose `proof_available`, never the storage key or a public image URL.
- `GET /contributions/{id}/proof` returns JPEG bytes with private/no-store headers.
  Only the active contributor or active cycle beneficiary can read the image.
  Group owners, other members, and global admins have no implicit access.

Images are bounded before multipart parsing, decoded using a PNG/JPEG allowlist,
checked for size/dimension limits, oriented, reduced to at most 2400 pixels on the
longest edge, and re-encoded without metadata. Keys are random. Legacy
`proof_screenshot_url` values are preserved for compatibility; they do not receive
the private storage guarantees and are never fetched by this new backend code.

## Operations and retention

No automatic retention deletion is enabled in phase 1. Agree a retention policy
and dispute handling before configuring lifecycle expiry. Deleting a screenshot
must not delete the transaction history. Do not configure a blanket 90-day object
expiry: it could remove proof before a tontine completes or a dispute is resolved.

A failure before the commit attempt triggers best-effort object cleanup. If a
commit is attempted but its outcome is uncertain, the object is retained for
reconciliation so a lost acknowledgement cannot delete valid proof. Cleanup failures
are logged with the opaque key for operational reconciliation. A successful commit
keeps its proof even if response/refresh fails; clients should reload contributions
after a network failure to avoid resubmitting an existing contribution. Direct
contribution deletion also requests cleanup after the database commit. Existing
group/user cascade deletion can leave private orphan objects: reconcile keys
against live contribution records during an approved retention/deletion job.

The capability flag defaults to false. Deploying the code does not provision a
bucket, change cloud permissions, migrate a live database, or enable uploads.

## Local verification

Install backend requirements plus the existing test dependencies (`httpx`, `pytest`
if using pytest). From the backend directory run:

```powershell
python -m unittest discover -s tests -p test_contribution_proofs.py
```

Tests use SQLite in memory and mocked storage only. They cover private access,
validation, optional JSON compatibility, multipart request limits, pending state,
duplicate submissions, storage failure, and pre/post-commit cleanup behavior.

References: [Pillow release](https://pillow.readthedocs.io/en/stable/releasenotes/12.3.0.html),
[S3 PutObject](https://docs.aws.amazon.com/boto3/latest/reference/services/s3/client/put_object.html).
