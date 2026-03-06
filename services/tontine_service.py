from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.payout import Payout
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User

try:
    from app.services.transaction_ledger_service import TransactionLedgerService
except ImportError:  # pragma: no cover - defensive import for missing service implementation
    TransactionLedgerService = None


class TontineService:
    """Service layer for tontine business logic."""

    MONEY_QUANT = Decimal("0.01")

    @staticmethod
    def _has_open_debt(db: Session, tontine_id: int, membership_id: int) -> bool:
        return (
            db.query(Debt.id)
            .filter(
                Debt.tontine_id == tontine_id,
                Debt.debtor_membership_id == membership_id,
                Debt.is_repaid.is_(False),
            )
            .first()
            is not None
        )

    @staticmethod
    def close_cycle(db: Session, cycle_id: int, current_user: User) -> Payout:
        """
        Close a cycle and create a payout atomically.

        Guarantees:
        - Owner-only operation
        - Row-level locking to prevent double close under concurrency
        - Full-funding validation based on active members
        - Idempotency guard (single payout per cycle)
        - Consistent money precision using Decimal(12,2)
        """
        try:
            cycle = (
                db.query(TontineCycle)
                .filter(TontineCycle.id == cycle_id)
                .with_for_update()
                .first()
            )
            if not cycle:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cycle not found",
                )

            if cycle.is_closed:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cycle {cycle.cycle_number} is already closed",
                )

            tontine = (
                db.query(Tontine)
                .filter(Tontine.id == cycle.tontine_id)
                .with_for_update()
                .first()
            )
            if not tontine:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Associated tontine not found",
                )

            if tontine.owner_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only owner can close cycle",
                )

            existing_payout = (
                db.query(Payout)
                .filter(Payout.cycle_id == cycle.id)
                .with_for_update()
                .first()
            )
            if existing_payout:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Payout already exists for cycle {cycle.cycle_number}",
                )

            payout_membership = TontineService._resolve_payout_membership(db, cycle, tontine.id)
            if not payout_membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payout member is not assigned and could not be determined automatically",
                )

            active_members = (
                db.query(TontineMembership.id, User.name)
                .join(User, User.id == TontineMembership.user_id)
                .filter(
                    TontineMembership.tontine_id == tontine.id,
                    TontineMembership.is_active.is_(True),
                )
                .all()
            )
            active_member_ids: Set[int] = {row[0] for row in active_members}
            active_member_names: Dict[int, str] = {row[0]: row[1] for row in active_members}
            # Beneficiary is exempt only when payout member was explicitly assigned for the cycle.
            explicit_payout_assigned = bool(cycle.payout_member_id)
            if explicit_payout_assigned:
                active_member_ids.discard(payout_membership.id)
                active_member_names.pop(payout_membership.id, None)

            covered_debtor_rows = (
                db.query(TontineMembership.id, User.name)
                .join(Debt, Debt.debtor_membership_id == TontineMembership.id)
                .join(User, User.id == TontineMembership.user_id)
                .filter(
                    Debt.cycle_id == cycle.id,
                    TontineMembership.tontine_id == tontine.id,
                )
                .all()
            )
            covered_debtor_ids: Set[int] = {row[0] for row in covered_debtor_rows}
            covered_debtor_names: Dict[int, str] = {row[0]: row[1] for row in covered_debtor_rows}
            if explicit_payout_assigned:
                covered_debtor_ids.discard(payout_membership.id)
                covered_debtor_names.pop(payout_membership.id, None)
            required_member_ids: Set[int] = active_member_ids | covered_debtor_ids
            required_member_names: Dict[int, str] = {**active_member_names, **covered_debtor_names}

            if not required_member_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active members in this tontine",
                )

            contribution_rows = (
                db.query(
                    Contribution.membership_id,
                    func.coalesce(func.sum(Contribution.amount), Decimal("0.00")),
                )
                .filter(
                    Contribution.cycle_id == cycle.id,
                    Contribution.is_confirmed.is_(True),
                )
                .group_by(Contribution.membership_id)
                .all()
            )

            contributed_members: Set[int] = {
                membership_id
                for membership_id, _ in contribution_rows
                if membership_id in required_member_ids
            }
            total_contributions = sum(
                (Decimal(amount) for membership_id, amount in contribution_rows if membership_id in required_member_ids),
                start=Decimal("0.00"),
            )
            total_contributions = TontineService._money(total_contributions)

            missing_member_ids = required_member_ids - contributed_members
            if missing_member_ids:
                missing_names = sorted(
                    [required_member_names[m_id] for m_id in missing_member_ids if m_id in required_member_names]
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing contributions from: {', '.join(missing_names)}",
                )

            expected_total = TontineService._money(
                Decimal(len(required_member_ids)) * Decimal(str(tontine.contribution_amount))
            )
            if total_contributions != expected_total:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cycle not fully funded. Expected: {expected_total}, "
                        f"Received: {total_contributions}"
                    ),
                )

            now = datetime.now(timezone.utc)
            cycle_number = cycle.cycle_number
            payout = Payout(
                cycle_id=cycle.id,
                membership_id=payout_membership.id,
                amount=total_contributions,
                is_paid=True,
                paid_at=now,
            )
            db.add(payout)

            cycle.is_closed = True
            cycle.closed_at = now
            cycle.payout_member_id = payout_membership.user_id

            tontine.current_cycle = max(tontine.current_cycle, cycle_number + 1)
            if tontine.current_cycle > tontine.total_cycles:
                tontine.status = TontineStatus.COMPLETED

            if TransactionLedgerService and hasattr(TransactionLedgerService, "log_payout"):
                TransactionLedgerService.log_payout(
                    db=db,
                    tontine_id=tontine.id,
                    cycle_id=cycle.id,
                    user_id=payout_membership.user_id,
                    amount=total_contributions,
                    description=f"Payout for cycle {cycle_number}",
                )

            db.commit()
            db.refresh(payout)
            return payout

        except HTTPException:
            db.rollback()
            raise
        except IntegrityError as exc:
            db.rollback()
            message = str(getattr(exc, "orig", exc)).lower()
            if (
                "uq_payout_cycle" in message
                or ("unique" in message and "payout" in message and "cycle" in message)
            ):
                cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_id).first()
                cycle_number = cycle.cycle_number if cycle else cycle_id
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Payout already exists for cycle {cycle_number}",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database integrity error occurred",
            )
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error occurred: {str(exc)}",
            )

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        """Normalize any money value to 2 decimal places."""
        return Decimal(value).quantize(TontineService.MONEY_QUANT)

    @staticmethod
    def _resolve_payout_membership(
        db: Session, cycle: TontineCycle, tontine_id: int
    ) -> Optional[TontineMembership]:
        """
        Resolve payout membership with backward compatibility:
        - preferred: cycle.payout_member_id stores user_id (schema-consistent)
        - fallback: cycle.payout_member_id stores membership_id (legacy usage)
        - if absent: determine from payout rotation
        """
        if cycle.payout_member_id:
            membership_by_user = (
                db.query(TontineMembership)
                .filter(
                    TontineMembership.tontine_id == tontine_id,
                    TontineMembership.user_id == cycle.payout_member_id,
                    TontineMembership.is_active.is_(True),
                )
                .with_for_update()
                .first()
            )
            if membership_by_user and not TontineService._has_open_debt(db, tontine_id, membership_by_user.id):
                return membership_by_user

            membership_by_id = (
                db.query(TontineMembership)
                .filter(
                    TontineMembership.tontine_id == tontine_id,
                    TontineMembership.id == cycle.payout_member_id,
                    TontineMembership.is_active.is_(True),
                )
                .with_for_update()
                .first()
            )
            if membership_by_id and not TontineService._has_open_debt(db, tontine_id, membership_by_id.id):
                return membership_by_id

        auto_member = TontineService._determine_payout_member(db, tontine_id, cycle.cycle_number)
        if auto_member:
            return (
                db.query(TontineMembership)
                .filter(TontineMembership.id == auto_member.id)
                .with_for_update()
                .first()
            )
        return None

    @staticmethod
    def _determine_payout_member(
        db: Session,
        tontine_id: int,
        cycle_number: int
    ) -> Optional[TontineMembership]:
        """Determine payout member from frozen rotation only."""
        frozen = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.is_active.is_(True),
                TontineMembership.rotation_position.isnot(None),
            )
            .order_by(TontineMembership.rotation_position.asc())
            .all()
        )
        frozen = [m for m in frozen if not TontineService._has_open_debt(db, tontine_id, m.id)]
        if not frozen:
            fallback = (
                db.query(TontineMembership)
                .filter(
                    TontineMembership.tontine_id == tontine_id,
                    TontineMembership.is_active.is_(True),
                    TontineMembership.payout_position == cycle_number,
                )
                .first()
            )
            if fallback and not TontineService._has_open_debt(db, tontine_id, fallback.id):
                return fallback
            return None

        target = ((cycle_number - 1) % len(frozen)) + 1
        for member in frozen:
            if member.rotation_position == target:
                return member
        return None

    @staticmethod
    def _freeze_rotation_positions(db: Session, tontine_id: int) -> List[TontineMembership]:
        active_members = (
            db.query(TontineMembership)
            .filter(
                TontineMembership.tontine_id == tontine_id,
                TontineMembership.is_active.is_(True),
            )
            .order_by(TontineMembership.joined_at.asc(), TontineMembership.id.asc())
            .with_for_update()
            .all()
        )
        if not active_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot freeze rotation without active members",
            )
        active_members = [m for m in active_members if not TontineService._has_open_debt(db, tontine_id, m.id)]
        if not active_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No beneficiary-eligible members (all have open debts)",
            )

        max_slots = len(active_members)
        used_positions: Set[int] = set()
        pinned: Dict[int, TontineMembership] = {}
        unpinned: List[TontineMembership] = []
        for member in active_members:
            override = member.payout_position
            if override is None:
                unpinned.append(member)
                continue

            if override < 1 or override > max_slots:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"payout_position must be between 1 and {max_slots}",
                )
            if override in used_positions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Duplicate payout_position override: {override}",
                )
            used_positions.add(override)
            pinned[override] = member

        free_positions = [p for p in range(1, max_slots + 1) if p not in used_positions]
        for position, member in zip(free_positions, unpinned):
            pinned[position] = member

        frozen = [pinned[p] for p in sorted(pinned.keys())]
        for idx, member in enumerate(frozen, start=1):
            member.rotation_position = idx
        return frozen

    @staticmethod
    def get_cycle_status(db: Session, tontine_id: int) -> Dict[str, Any]:
        """Get status of all cycles for a tontine."""
        cycles = db.query(TontineCycle).filter(
            TontineCycle.tontine_id == tontine_id
        ).order_by(TontineCycle.cycle_number).all()

        active_members = db.query(TontineMembership).filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.is_active == True
        ).count()

        result = []
        for cycle in cycles:
            contributions = db.query(Contribution).filter(
                Contribution.cycle_id == cycle.id
            ).all()

            total_amount = sum((Decimal(c.amount) for c in contributions), start=Decimal("0.00")) if contributions else Decimal("0.00")

            payout = db.query(Payout).filter(
                Payout.cycle_id == cycle.id
            ).first()

            payout_member_name = None
            payout_membership = None
            if cycle.payout_member_id:
                user = db.query(User).filter(User.id == cycle.payout_member_id).first()
                payout_member_name = user.name if user else None
                payout_membership = (
                    db.query(TontineMembership)
                    .filter(
                        TontineMembership.tontine_id == tontine_id,
                        TontineMembership.user_id == cycle.payout_member_id,
                        TontineMembership.is_active.is_(True),
                    )
                    .first()
                )

            expected_contributions = active_members
            if cycle.payout_member_id and payout_membership:
                expected_contributions = max(expected_contributions - 1, 0)

            result.append({
                "cycle_id": cycle.id,
                "cycle_number": cycle.cycle_number,
                "is_closed": cycle.is_closed,
                "closed_at": cycle.closed_at,
                "contributions_count": len(contributions),
                "expected_contributions": expected_contributions,
                "all_paid": len(contributions) >= expected_contributions,
                "total_amount": total_amount,
                "payout_processed": payout is not None,
                "payout_amount": payout.amount if payout else None,
                "payout_member_id": cycle.payout_member_id,
                "payout_member_name": payout_member_name
            })

        return {
            "tontine_id": tontine_id,
            "total_cycles": len(cycles),
            "cycles": result
        }

    @staticmethod
    def generate_cycles(db: Session, tontine_id: int, current_user: User) -> List[TontineCycle]:
        """Generate all cycles for a tontine."""
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()

        if not tontine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tontine not found"
            )

        if tontine.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner can generate cycles"
            )

        existing = db.query(TontineCycle).filter(
            TontineCycle.tontine_id == tontine_id
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cycles already generated for this tontine"
            )

        frozen_members = TontineService._freeze_rotation_positions(db, tontine_id)

        if tontine.frequency == "weekly":
            cycle_duration = timedelta(days=7)
        elif tontine.frequency == "monthly":
            cycle_duration = timedelta(days=30)
        else:
            cycle_duration = timedelta(days=7)

        cycles = []
        start_date = tontine.created_at.replace(hour=0, minute=0, second=0, microsecond=0)

        for i in range(1, tontine.total_cycles + 1):
            cycle_end = start_date + cycle_duration
            payout_index = (i - 1) % len(frozen_members)
            payout_user_id = frozen_members[payout_index].user_id

            cycle = TontineCycle(
                tontine_id=tontine_id,
                cycle_number=i,
                payout_member_id=payout_user_id,
                start_date=start_date,
                end_date=cycle_end,
                contribution_deadline=cycle_end,
                grace_period_hours=24,
                is_closed=False
            )

            cycles.append(cycle)
            start_date = cycle_end

        db.add_all(cycles)
        db.commit()

        for cycle in cycles:
            db.refresh(cycle)

        return cycles

    @staticmethod
    def assign_payout_member(
        db: Session,
        cycle_id: int,
        member_id: int,
        current_user: User
    ) -> TontineCycle:
        """Assign a member to receive payout for a cycle."""
        cycle = db.query(TontineCycle).filter(
            TontineCycle.id == cycle_id
        ).first()

        if not cycle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cycle not found"
            )

        tontine = db.query(Tontine).filter(
            Tontine.id == cycle.tontine_id
        ).first()

        if tontine.owner_id != current_user.id:
            admin = db.query(TontineMembership).filter(
                TontineMembership.user_id == current_user.id,
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.role == "admin"
            ).first()

            if not admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only owner or admin can assign payout members"
                )

        member = db.query(TontineMembership).filter(
            TontineMembership.id == member_id,
            TontineMembership.tontine_id == tontine.id
        ).first()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this tontine"
            )
        if TontineService._has_open_debt(db, tontine.id, member.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Member with open debt cannot be selected as beneficiary",
            )

        cycle.payout_member_id = member.user_id
        db.commit()
        db.refresh(cycle)

        return cycle
