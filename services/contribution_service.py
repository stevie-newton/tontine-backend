from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any
import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.tontine_cycle import TontineCycle
from app.models.tontine import Tontine
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.transaction_ledger_service import TransactionLedgerService
from app.services.web_push_event_service import send_web_push_to_user


class ContributionService:
    """Service layer for contribution business logic."""

    MONEY_Q = Decimal("0.01")

    @staticmethod
    def _q(amount: Decimal) -> Decimal:
        return Decimal(amount).quantize(ContributionService.MONEY_Q, rounding=ROUND_HALF_UP)

    @staticmethod
    def create_contribution(
        db: Session,
        cycle_id: int,
        current_user: User,
        amount: Decimal,  # ✅ Decimal (matches Numeric(12,2))
        transaction_reference: str,
        proof_screenshot_url: Optional[str] = None,
    ) -> Contribution:
        """
        Create a new contribution for a cycle.

        Rules:
        - Cycle must exist and not be closed
        - User must be active member of the tontine
        - Amount must match tontine.contribution_amount (to cents)
        - One contribution per membership per cycle (enforced by DB)
        - Uses row lock on cycle to avoid contribute vs close_cycle race
        """

        now = datetime.now(timezone.utc)

        try:
            # 🔒 Lock cycle row (avoid contributing while it’s being closed)
            cycle: Optional[TontineCycle] = (
                db.query(TontineCycle)
                .filter(TontineCycle.id == cycle_id)
                .with_for_update()
                .first()
            )
            if not cycle:
                raise HTTPException(status_code=404, detail=f"Cycle with id {cycle_id} not found")

            if cycle.is_closed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cycle {cycle.cycle_number} is already closed",
                )

            tontine: Optional[Tontine] = (
                db.query(Tontine)
                .filter(Tontine.id == cycle.tontine_id)
                .first()
            )
            if not tontine:
                raise HTTPException(status_code=404, detail="Associated tontine not found")

            # Recommended: only allow contributions for current cycle
            if cycle.cycle_number != tontine.current_cycle:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contributions only allowed for current cycle (current: {tontine.current_cycle})",
                )

            membership: Optional[TontineMembership] = (
                db.query(TontineMembership)
                .filter(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.tontine_id == tontine.id,
                    TontineMembership.is_active.is_(True),
                )
                .first()
            )
            if not membership:
                raise HTTPException(
                    status_code=403,
                    detail="You are not an active member of this tontine",
                )

            if cycle.payout_member_id == current_user.id:
                raise HTTPException(
                    status_code=403,
                    detail="The beneficiary for this cycle cannot contribute",
                )

            provided_amount = ContributionService._q(Decimal(str(amount)))
            expected_amount = ContributionService._q(Decimal(str(tontine.contribution_amount)))

            if provided_amount != expected_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contribution must be exactly {expected_amount} (provided: {provided_amount})",
                )

            # ✅ Don’t do a pre-check query; rely on unique constraint + IntegrityError
            ref = (transaction_reference or "").strip()
            if not ref:
                ref = str(uuid.uuid4())

            contribution = Contribution(
                membership_id=membership.id,
                cycle_id=cycle.id,
                amount=provided_amount,
                transaction_reference=ref,
                proof_screenshot_url=(proof_screenshot_url.strip() if proof_screenshot_url else None),
                beneficiary_decision="pending",
                is_confirmed=False,
                ledger_entry_created=False,
                paid_at=now,
            )
            db.add(contribution)

            db.commit()
            db.refresh(contribution)

            if cycle.payout_member_id:
                try:
                    send_web_push_to_user(
                        db,
                        user_id=cycle.payout_member_id,
                        title="Contribution submitted",
                        body=f"{current_user.name} submitted a contribution for cycle {cycle.cycle_number}.",
                        url=f"/tontines/{tontine.id}/cycles/{cycle.id}",
                        tag=f"contribution_pending_{contribution.id}",
                        data={
                            "tontine_id": tontine.id,
                            "cycle_id": cycle.id,
                            "contribution_id": contribution.id,
                        },
                    )
                except Exception:
                    pass

            return contribution

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already contributed to this cycle",
            )
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Database error occurred")

    @staticmethod
    def get_cycle_contributions(
        db: Session,
        cycle_id: int,
        current_user: User,
    ) -> List[Dict[str, Any]]:
        """
        Get all contributions for a cycle with member details.
        Accessible by tontine owner OR any active member of that tontine.
        """
        cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
        if not tontine:
            raise HTTPException(status_code=404, detail="Associated tontine not found")

        if tontine.owner_id != current_user.id:
            membership = db.query(TontineMembership).filter(
                TontineMembership.user_id == current_user.id,
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(True),
            ).first()

            if not membership:
                raise HTTPException(status_code=403, detail="You don't have access to this cycle's contributions")

        rows = (
            db.query(
                Contribution,
                User.name.label("member_name"),
                User.phone.label("member_phone"),
            )
            .join(TontineMembership, TontineMembership.id == Contribution.membership_id)
            .join(User, User.id == TontineMembership.user_id)
            .filter(Contribution.cycle_id == cycle_id)
            .order_by(User.name.asc())
            .all()
        )

        return [
            {
                "id": c.id,
                "membership_id": c.membership_id,
                "cycle_id": c.cycle_id,
                "user_id": c.membership.user_id,
                "user_name": name,
                "user_phone": phone,
                "amount": c.amount,
                "transaction_reference": c.transaction_reference,
                "proof_screenshot_url": c.proof_screenshot_url,
                "beneficiary_decision": c.beneficiary_decision,
                "is_confirmed": c.is_confirmed,
                "ledger_entry_created": c.ledger_entry_created,
                "paid_at": c.paid_at,
            }
            for (c, name, phone) in rows
        ]

    @staticmethod
    def get_member_contributions(
        db: Session,
        tontine_id: int,
        current_user: User,
    ) -> List[Dict[str, Any]]:
        """Get all contributions for the current user in a specific tontine."""
        membership = db.query(TontineMembership).filter(
            TontineMembership.user_id == current_user.id,
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active.is_(True),
        ).first()

        if not membership:
            raise HTTPException(status_code=404, detail="You are not a member of this tontine")

        rows = (
            db.query(
                Contribution,
                TontineCycle.cycle_number,
                TontineCycle.is_closed.label("cycle_closed"),
            )
            .join(TontineCycle, TontineCycle.id == Contribution.cycle_id)
            .filter(Contribution.membership_id == membership.id)
            .order_by(TontineCycle.cycle_number.asc())
            .all()
        )

        return [
            {
                "id": c.id,
                "cycle_id": c.cycle_id,
                "cycle_number": cycle_number,
                "amount": c.amount,
                "is_confirmed": c.is_confirmed,
                "paid_at": c.paid_at,
                "cycle_closed": cycle_closed,
            }
            for (c, cycle_number, cycle_closed) in rows
        ]

    @staticmethod
    def confirm_contribution(
        db: Session,
        contribution_id: int,
        current_user: User,
        confirm: bool = True,
    ) -> Contribution:
        """Confirm or reject a contribution (owner/admin)."""
        now = datetime.now(timezone.utc)
        contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
        if not contribution:
            raise HTTPException(status_code=404, detail="Contribution not found")

        membership = db.query(TontineMembership).filter(TontineMembership.id == contribution.membership_id).first()
        if not membership:
            raise HTTPException(status_code=404, detail="Membership not found")

        tontine = db.query(Tontine).filter(Tontine.id == membership.tontine_id).first()
        if not tontine:
            raise HTTPException(status_code=404, detail="Tontine not found")

        if tontine.owner_id != current_user.id:
            admin_membership = db.query(TontineMembership).filter(
                TontineMembership.user_id == current_user.id,
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.role == "admin",
                TontineMembership.is_active.is_(True),
            ).first()

            if not admin_membership:
                raise HTTPException(status_code=403, detail="Only owner or admin can confirm contributions")

        contribution.is_confirmed = confirm
        contribution.beneficiary_decision = "confirmed" if confirm else "rejected"
        contribution.confirmed_by_user_id = current_user.id
        contribution.confirmed_at = now
        db.commit()
        db.refresh(contribution)
        return contribution

    @staticmethod
    def beneficiary_confirm_contribution(
        db: Session,
        contribution_id: int,
        current_user: User,
        decision: str,
    ) -> Contribution:
        """Beneficiary confirms or rejects a submitted contribution."""
        normalized_decision = (decision or "").strip().lower()
        if normalized_decision not in {"confirm", "reject"}:
            raise HTTPException(status_code=400, detail="Decision must be 'confirm' or 'reject'")

        now = datetime.now(timezone.utc)
        contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
        if not contribution:
            raise HTTPException(status_code=404, detail="Contribution not found")

        cycle = db.query(TontineCycle).filter(TontineCycle.id == contribution.cycle_id).first()
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
        if not tontine:
            raise HTTPException(status_code=404, detail="Tontine not found")

        membership = db.query(TontineMembership).filter(TontineMembership.id == contribution.membership_id).first()
        if not membership:
            raise HTTPException(status_code=404, detail="Membership not found")

        if not cycle.payout_member_id:
            raise HTTPException(status_code=400, detail="This cycle has no beneficiary assigned yet")

        if cycle.payout_member_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the cycle beneficiary can confirm this contribution")

        if contribution.is_confirmed and normalized_decision == "confirm":
            return contribution

        if contribution.beneficiary_decision == "rejected" and normalized_decision == "reject":
            return contribution

        if contribution.ledger_entry_created and normalized_decision == "reject":
            raise HTTPException(status_code=409, detail="Confirmed contributions cannot be rejected after ledger entry creation")

        contribution.beneficiary_decision = "confirmed" if normalized_decision == "confirm" else "rejected"
        contribution.is_confirmed = normalized_decision == "confirm"
        contribution.confirmed_by_user_id = current_user.id
        contribution.confirmed_at = now

        if normalized_decision == "confirm" and not contribution.ledger_entry_created:
            TransactionLedgerService.log_contribution(
                db=db,
                tontine_id=tontine.id,
                cycle_id=cycle.id,
                user_id=membership.user_id,
                amount=Decimal(str(contribution.amount)),
                description=f"Confirmed contribution for cycle {cycle.cycle_number}",
                contribution_id=contribution.id,
            )
            contribution.ledger_entry_created = True

        db.commit()
        db.refresh(contribution)

        try:
            send_web_push_to_user(
                db,
                user_id=membership.user_id,
                title="Contribution review update",
                body=(
                    f"Your contribution for cycle {cycle.cycle_number} was confirmed."
                    if normalized_decision == "confirm"
                    else f"Your contribution for cycle {cycle.cycle_number} was rejected."
                ),
                url=f"/tontines/{tontine.id}/cycles/{cycle.id}",
                tag=f"contribution_review_{contribution.id}",
                data={
                    "tontine_id": tontine.id,
                    "cycle_id": cycle.id,
                    "contribution_id": contribution.id,
                    "decision": normalized_decision,
                },
            )
        except Exception:
            pass

        return contribution

    @staticmethod
    def get_contribution_summary(
        db: Session,
        tontine_id: int,
        cycle_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Summary statistics for contributions.
        NOTE: Uses Decimal-safe totals; no integer division.
        """
        membership_ids = [
            m_id
            for (m_id,) in db.query(TontineMembership.id).filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.is_active.is_(True),
            ).all()
        ]
        total_members = len(membership_ids)

        if total_members == 0:
            return {
                "tontine_id": tontine_id,
                "cycle_id": cycle_id,
                "total_members": 0,
                "total_contributions": 0,
                "confirmed_contributions": 0,
                "pending_contributions": 0,
                "total_amount": Decimal("0.00"),
                "cycle_info": None,
                "average_per_member": Decimal("0.00"),
            }

        q = db.query(Contribution).filter(Contribution.membership_id.in_(membership_ids))
        if cycle_id:
            q = q.filter(Contribution.cycle_id == cycle_id)

        contributions = q.all()

        total_amount = sum((Decimal(str(c.amount)) for c in contributions), Decimal("0.00"))
        confirmed_count = sum(1 for c in contributions if c.is_confirmed)

        cycle_info = None
        if cycle_id:
            cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
            if cycle:
                cycle_info = {
                    "cycle_number": cycle.cycle_number,
                    "is_closed": cycle.is_closed,
                    "expected_contributions": total_members,
                    "actual_contributions": len(contributions),
                    "all_paid": len(contributions) >= total_members,
                    "total_amount": total_amount,
                }

        average = (total_amount / Decimal(total_members)).quantize(ContributionService.MONEY_Q, rounding=ROUND_HALF_UP)

        return {
            "tontine_id": tontine_id,
            "cycle_id": cycle_id,
            "total_members": total_members,
            "total_contributions": len(contributions),
            "confirmed_contributions": confirmed_count,
            "pending_contributions": len(contributions) - confirmed_count,
            "total_amount": total_amount,
            "cycle_info": cycle_info,
            "average_per_member": average,
        }
