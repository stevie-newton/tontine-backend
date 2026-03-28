from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.contribution import Contribution
from app.models.payment import Payment
from app.models.payout import Payout
from app.models.debt import Debt
from app.models.transaction_ledger import TransactionLedger
from app.models.user import User
from app.services.transaction_ledger_service import TransactionLedgerService

try:
    from app.services.web_push_event_service import send_web_push_to_user, send_web_push_to_users
except ImportError:  # pragma: no cover - optional push helper not deployed everywhere yet
    def send_web_push_to_user(*args, **kwargs):
        return None

    def send_web_push_to_users(*args, **kwargs):
        return None


class TontineService:
    """Service layer for tontine business logic."""

    MONEY_Q = Decimal("0.01")

    @staticmethod
    def cycle_duration_for_frequency(frequency: str):
        if frequency == "monthly":
            from datetime import timedelta

            return timedelta(days=30)
        from datetime import timedelta

        return timedelta(days=7)

    @staticmethod
    def has_financial_activity(db: Session, tontine_id: int) -> bool:
        contribution_exists = (
            db.query(Contribution.id)
            .join(TontineCycle, TontineCycle.id == Contribution.cycle_id)
            .filter(TontineCycle.tontine_id == tontine_id)
            .first()
            is not None
        )
        if contribution_exists:
            return True

        payment_exists = (
            db.query(Payment.id)
            .join(TontineCycle, TontineCycle.id == Payment.cycle_id)
            .filter(TontineCycle.tontine_id == tontine_id)
            .first()
            is not None
        )
        if payment_exists:
            return True

        payout_exists = (
            db.query(Payout.id)
            .filter(Payout.tontine_id == tontine_id)
            .first()
            is not None
        )
        if payout_exists:
            return True

        debt_exists = (
            db.query(Debt.id)
            .filter(Debt.tontine_id == tontine_id)
            .first()
            is not None
        )
        if debt_exists:
            return True

        ledger_exists = (
            db.query(TransactionLedger.id)
            .filter(TransactionLedger.tontine_id == tontine_id)
            .first()
            is not None
        )
        return ledger_exists

    @staticmethod
    def ensure_owner_membership(db: Session, tontine: Tontine) -> Optional[TontineMembership]:
        """Make sure the owner participates in the tontine rotation as the first beneficiary."""
        if not tontine:
            return None

        membership = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.user_id == tontine.owner_id,
            )
            .first()
        )
        if membership:
            membership.is_active = True
            membership.role = "admin"
            return membership

        membership = TontineMembership(
            user_id=tontine.owner_id,
            tontine_id=tontine.id,
            role="admin",
            is_active=True,
        )
        db.add(membership)
        db.flush()
        return membership

    @staticmethod
    def _ordered_active_memberships(
        db: Session,
        tontine_id: int,
        owner_id: int,
    ) -> list[TontineMembership]:
        return (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.is_active.is_(True),
            )
            .order_by(
                case((TontineMembership.user_id == owner_id, 0), else_=1),
                TontineMembership.joined_at.desc(),
                TontineMembership.id.desc(),
            )
            .all()
        )

    @staticmethod
    def sync_rotation_order(db: Session, tontine: Tontine) -> None:
        """Rebuild beneficiary order: owner first, then active members by most recent join."""
        if not tontine:
            return

        TontineService.ensure_owner_membership(db, tontine)

        active_members = TontineService._ordered_active_memberships(db, tontine.id, tontine.owner_id)
        for index, membership in enumerate(active_members, start=1):
            membership.payout_position = index

        inactive_members = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(False),
            )
            .all()
        )
        for membership in inactive_members:
            membership.payout_position = None

    @staticmethod
    def sync_draft_payout_order(db: Session, tontine: Tontine) -> None:
        """
        Keep beneficiary order aligned to the business rule:
        owner first, then active members by most recently added.
        """
        if not tontine:
            return

        status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
        if status_value != TontineStatus.DRAFT.value:
            return

        TontineService.sync_rotation_order(db, tontine)

    @staticmethod
    def sync_draft_total_cycles(db: Session, tontine: Tontine) -> bool:
        """
        Keep total_cycles proportional to the current active-member count while
        the tontine is still in draft.

        Returns True when the persisted value changed.
        """
        if not tontine:
            return False

        status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
        if status_value != TontineStatus.DRAFT.value:
            return False

        TontineService.ensure_owner_membership(db, tontine)

        active_count = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(True),
            )
            .count()
        )
        desired_total = max(1, active_count, tontine.current_cycle)
        if tontine.total_cycles == desired_total:
            return False

        tontine.total_cycles = desired_total
        return True

    @staticmethod
    def sync_total_cycles_to_active_members_if_safe(db: Session, tontine: Tontine) -> bool:
        """
        Keep total_cycles aligned with active members when it is still safe to do so.

        We fully resync before any financial activity exists.
        After financial activity exists, we only allow safe upward expansion
        (for example 2 -> 3 cycles) and never shrink the schedule.
        """
        if not tontine:
            return False

        status_value = tontine.status.value if hasattr(tontine.status, "value") else str(tontine.status)
        if status_value == TontineStatus.COMPLETED.value:
            return False

        TontineService.ensure_owner_membership(db, tontine)

        active_count = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(True),
            )
            .count()
        )
        desired_total = max(1, active_count, tontine.current_cycle)
        has_activity = TontineService.has_financial_activity(db, tontine.id)

        if has_activity and desired_total < tontine.total_cycles:
            return False

        if tontine.total_cycles == desired_total:
            return False

        tontine.total_cycles = desired_total
        return True

    @staticmethod
    def sync_cycle_rows_to_active_members_if_safe(db: Session, tontine: Tontine) -> bool:
        """
        Keep generated cycle rows aligned with total_cycles when it is still safe.

        Before financial activity exists, cycle rows may grow or shrink.
        After financial activity exists, we only append missing future cycles
        and never delete existing ones.
        """
        if not tontine:
            return False

        changed = TontineService.sync_total_cycles_to_active_members_if_safe(db, tontine)
        has_activity = TontineService.has_financial_activity(db, tontine.id)

        cycles = (
            db.query(TontineCycle)
            .filter(TontineCycle.tontine_id == tontine.id)
            .order_by(TontineCycle.cycle_number.asc())
            .all()
        )
        if not cycles:
            return changed

        desired_total = tontine.total_cycles
        cycle_duration = TontineService.cycle_duration_for_frequency(tontine.frequency)

        if len(cycles) > desired_total:
            if has_activity:
                return changed
            for cycle in cycles:
                if cycle.cycle_number > desired_total:
                    db.delete(cycle)
                    changed = True
            return changed

        if len(cycles) < desired_total:
            last_cycle = cycles[-1]
            start_date = last_cycle.end_date
            existing_numbers = {cycle.cycle_number for cycle in cycles}
            for cycle_number in range(1, desired_total + 1):
                if cycle_number in existing_numbers:
                    continue
                end_date = start_date + cycle_duration
                db.add(
                    TontineCycle(
                        tontine_id=tontine.id,
                        cycle_number=cycle_number,
                        start_date=start_date,
                        end_date=end_date,
                        is_closed=False,
                    )
                )
                start_date = end_date
                changed = True

        if TontineService.ensure_cycle_payout_assignments(db, tontine):
            changed = True

        return changed

    @staticmethod
    def ensure_cycle_payout_assignments(db: Session, tontine: Tontine) -> bool:
        """Assign payout members automatically from the frozen rotation when missing."""
        if not tontine:
            return False

        cycles = (
            db.query(TontineCycle)
            .filter(TontineCycle.tontine_id == tontine.id)
            .order_by(TontineCycle.cycle_number.asc())
            .all()
        )
        if not cycles:
            return False

        changed = False
        active_user_ids = {
            user_id
            for (user_id,) in (
                db.query(TontineMembership.user_id)
                .filter(
                    TontineMembership.tontine_id == tontine.id,
                    TontineMembership.is_active.is_(True),
                )
                .all()
            )
        }

        for cycle in cycles:
            payout_missing = cycle.payout_member_id is None
            payout_inactive = cycle.payout_member_id is not None and cycle.payout_member_id not in active_user_ids
            if not payout_missing and not payout_inactive:
                continue

            payout_member = TontineService._determine_payout_member(db, tontine.id, cycle.cycle_number)
            if payout_member and cycle.payout_member_id != payout_member.user_id:
                cycle.payout_member_id = payout_member.user_id
                changed = True

        return changed

    @staticmethod
    def _expected_contributor_memberships(
        db: Session,
        tontine_id: int,
        payout_member_id: Optional[int],
    ) -> list[TontineMembership]:
        members = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.is_active.is_(True),
            )
            .all()
        )
        return [member for member in members if member.user_id != payout_member_id]

    @staticmethod
    def close_cycle(db: Session, cycle_id: int, current_user: User) -> Payout:
        """
        Close a tontine cycle safely.

        Guarantees:
        - Prevents double-close via row locks
        - Ensures all ACTIVE members contributed (distinct membership_id)
        - Ensures payout is created once (idempotent best-effort + DB unique constraint)
        - Logs payout to ledger
        """

        now = datetime.now(timezone.utc)

        try:
            # 🔒 Lock cycle row (prevents double close)
            cycle: Optional[TontineCycle] = (
                db.query(TontineCycle)
                .filter(TontineCycle.id == cycle_id)
                .with_for_update()
                .first()
            )
            if not cycle:
                raise HTTPException(status_code=404, detail="Cycle not found")

            if cycle.is_closed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cycle {cycle.cycle_number} is already closed",
                )

            # 🔒 Lock tontine row
            tontine: Optional[Tontine] = (
                db.query(Tontine)
                .filter(Tontine.id == cycle.tontine_id)
                .with_for_update()
                .first()
            )
            if not tontine:
                raise HTTPException(status_code=404, detail="Associated tontine not found")

            # Permission: only owner
            if tontine.owner_id != current_user.id:
                raise HTTPException(status_code=403, detail="Only owner can close cycle")

            # Optional but recommended: enforce sequential closing
            if cycle.cycle_number != tontine.current_cycle:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only current cycle can be closed (current: {tontine.current_cycle})",
                )

            if not cycle.payout_member_id:
                payout_member = TontineService._determine_payout_member(db, tontine.id, cycle.cycle_number)
                if not payout_member:
                    raise HTTPException(
                        status_code=400,
                        detail="Payout member could not be determined automatically",
                    )
                cycle.payout_member_id = payout_member.user_id

            expected_memberships = TontineService._expected_contributor_memberships(
                db=db,
                tontine_id=tontine.id,
                payout_member_id=cycle.payout_member_id,
            )
            active_members_count = len(expected_memberships)
            active_user_ids = [
                user_id
                for (user_id,) in (
                    db.query(TontineMembership.user_id)
                    .filter(
                        TontineMembership.tontine_id == tontine.id,
                        TontineMembership.is_active.is_(True),
                    )
                    .all()
                )
            ]

            if active_members_count == 0:
                raise HTTPException(status_code=400, detail="No eligible contributors in this tontine")

            # Distinct confirmed members count (dual-confirmation workflow)
            confirmed_members_count: int = (
                db.query(func.count(func.distinct(Contribution.membership_id)))
                .filter(
                    Contribution.cycle_id == cycle.id,
                    Contribution.is_confirmed.is_(True),
                    Contribution.membership_id.in_([membership.id for membership in expected_memberships]),
                )
                .scalar()
                or 0
            )

            if confirmed_members_count != active_members_count:
                # Show who is missing a confirmed contribution.
                missing_rows = (
                    db.query(User.name)
                    .join(TontineMembership, TontineMembership.user_id == User.id)
                    .outerjoin(
                        Contribution,
                        and_(
                            Contribution.membership_id == TontineMembership.id,
                            Contribution.cycle_id == cycle.id,
                            Contribution.is_confirmed.is_(True),
                        ),
                    )
                    .filter(
                        TontineMembership.tontine_id == tontine.id,
                        TontineMembership.is_active.is_(True),
                        TontineMembership.user_id != cycle.payout_member_id,
                        Contribution.id.is_(None),
                    )
                    .all()
                )
                missing_names = [r[0] for r in missing_rows]

                raise HTTPException(
                    status_code=400,
                    detail=f"Pending confirmations from: {', '.join(missing_names)}",
                )

            # Sum confirmed contributions (Decimal)
            total_contributions: Decimal = (
                db.query(func.coalesce(func.sum(Contribution.amount), Decimal("0.00")))
                .filter(
                    Contribution.cycle_id == cycle.id,
                    Contribution.is_confirmed.is_(True),
                    Contribution.membership_id.in_([membership.id for membership in expected_memberships]),
                )
                .scalar()
                or Decimal("0.00")
            )

            # Quantize money to cents (optional but recommended)
            total_contributions = total_contributions.quantize(TontineService.MONEY_Q, rounding=ROUND_HALF_UP)

            expected_total = (Decimal(active_members_count) * Decimal(str(tontine.contribution_amount))).quantize(
                TontineService.MONEY_Q,
                rounding=ROUND_HALF_UP,
            )

            if total_contributions != expected_total:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cycle not fully funded. Expected: {expected_total}, Received: {total_contributions}",
                )

            # Fetch payout membership (for ledger user_id)
            payout_membership: Optional[TontineMembership] = (
                db.query(TontineMembership)
                .filter(
                    TontineMembership.tontine_id == tontine.id,
                    TontineMembership.user_id == cycle.payout_member_id,
                    TontineMembership.is_active.is_(True),
                )
                .first()
            )
            if not payout_membership:
                raise HTTPException(status_code=404, detail="Payout member not found")

            # Idempotency guard (nice UX)
            existing_payout = db.query(Payout.id).filter(Payout.cycle_id == cycle.id).first()
            if existing_payout:
                raise HTTPException(status_code=400, detail="Payout already exists for this cycle")

            # 💰 Create payout (processed immediately in your current design)
            payout = Payout(
                tontine_id=tontine.id,
                cycle_id=cycle.id,
                membership_id=payout_membership.id,
                amount=total_contributions,
                is_processed=True,
                processed_at=now,
            )
            db.add(payout)

            # Close cycle
            cycle.is_closed = True
            cycle.closed_at = now

            # Advance cycle
            tontine.current_cycle = cycle.cycle_number + 1
            if tontine.current_cycle > tontine.total_cycles:
                tontine.status = TontineStatus.COMPLETED.value

            # 🧾 Ledger log (same DB transaction)
            TransactionLedgerService.log_payout(
                db=db,
                tontine_id=tontine.id,
                cycle_id=cycle.id,
                user_id=payout_membership.user_id,
                amount=total_contributions,
                description=f"Payout for cycle {cycle.cycle_number}",
            )

            db.commit()
            db.refresh(payout)

            try:
                send_web_push_to_user(
                    db,
                    user_id=payout_membership.user_id,
                    title="Payout received",
                    body=f"You received a payout from {tontine.name}.",
                    url=f"/tontines/{tontine.id}/cycles/{cycle.id}",
                    tag=f"cycle_payout_{cycle.id}",
                    data={
                        "tontine_id": tontine.id,
                        "cycle_id": cycle.id,
                        "payout_id": payout.id,
                    },
                )
            except Exception:
                pass

            try:
                send_web_push_to_users(
                    db,
                    user_ids=active_user_ids,
                    title="Cycle closed",
                    body=f"{tontine.name} \u2022 Cycle {cycle.cycle_number} has been closed.",
                    url=f"/tontines/{tontine.id}/cycles/{cycle.id}",
                    tag=f"cycle_closed_{cycle.id}",
                    data={"tontine_id": tontine.id, "cycle_id": cycle.id},
                )
            except Exception:
                pass

            return payout

        except IntegrityError:
            # This is where your UNIQUE constraints save you (e.g., payout.cycle_id)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate operation detected (payout already exists).",
            )

        except HTTPException:
            # Don’t wrap our own HTTP errors
            db.rollback()
            raise

        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred",
            )

    @staticmethod
    def _determine_payout_member(db: Session, tontine_id: int, cycle_number: int) -> Optional[TontineMembership]:
        """Determine payout member automatically if not assigned."""
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            return None

        member = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.payout_position == cycle_number,
                TontineMembership.is_active.is_(True),
            )
            .first()
        )
        if member:
            return member

        all_members = TontineService._ordered_active_memberships(db, tontine_id, tontine.owner_id)
        if not all_members:
            return None

        position = (cycle_number - 1) % len(all_members)
        return all_members[position]

    @staticmethod
    def get_cycle_status(db: Session, tontine_id: int) -> dict:
        """
        Summary view of every cycle in a tontine for legacy `/cycles/status/{tontine_id}`
        consumers on the web app.
        """
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise HTTPException(status_code=404, detail="Tontine not found")

        TontineService.sync_cycle_rows_to_active_members_if_safe(db, tontine)
        TontineService.ensure_cycle_payout_assignments(db, tontine)

        cycles = (
            db.query(TontineCycle)
            .filter(TontineCycle.tontine_id == tontine_id)
            .order_by(TontineCycle.cycle_number.asc())
            .all()
        )

        cycle_rows: list[dict] = []
        for cycle in cycles:
            expected_memberships = TontineService._expected_contributor_memberships(
                db=db,
                tontine_id=tontine_id,
                payout_member_id=cycle.payout_member_id,
            )
            expected_contributions = len(expected_memberships)
            expected_membership_ids = [membership.id for membership in expected_memberships]

            contribution_query = db.query(Contribution).filter(
                Contribution.cycle_id == cycle.id,
                Contribution.is_confirmed.is_(True),
            )
            if expected_membership_ids:
                contribution_query = contribution_query.filter(
                    Contribution.membership_id.in_(expected_membership_ids)
                )
            contributions = contribution_query.all()
            contribution_count = len(contributions)
            total_amount = sum((Decimal(str(item.amount)) for item in contributions), Decimal("0.00"))
            total_amount = total_amount.quantize(TontineService.MONEY_Q, rounding=ROUND_HALF_UP)

            payout = db.query(Payout).filter(Payout.cycle_id == cycle.id).first()
            payout_member_name = None
            if cycle.payout_member_id:
                payout_member = db.query(User).filter(User.id == cycle.payout_member_id).first()
                if payout_member:
                    payout_member_name = payout_member.name

            cycle_rows.append(
                {
                    "cycle_id": cycle.id,
                    "cycle_number": cycle.cycle_number,
                    "is_closed": bool(cycle.is_closed),
                    "closed_at": cycle.closed_at,
                    "contributions_count": contribution_count,
                    "expected_contributions": expected_contributions,
                    "all_paid": contribution_count >= expected_contributions if expected_contributions > 0 else False,
                    "total_amount": total_amount,
                    "payout_processed": bool(payout.is_processed) if payout else False,
                    "payout_amount": payout.amount if payout else None,
                    "payout_member_name": payout_member_name,
                }
            )

        return {
            "tontine_id": tontine_id,
            "total_cycles": tontine.total_cycles,
            "cycles": cycle_rows,
        }
