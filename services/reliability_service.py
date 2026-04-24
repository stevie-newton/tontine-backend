from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership


def build_reliability_report_for_memberships(
    db: Session,
    memberships: Iterable[TontineMembership],
    *,
    user_id: int,
    tontine_id: int | None = None,
) -> dict:
    membership_list = list(memberships)
    membership_ids = [membership.id for membership in membership_list]
    tontine_ids = list({membership.tontine_id for membership in membership_list})
    now = datetime.now(timezone.utc)

    contributions = []
    if membership_ids:
        contributions = (
            db.query(Contribution)
            .filter(
                Contribution.membership_id.in_(membership_ids),
                Contribution.is_confirmed.is_(True),
            )
            .all()
        )
    contribution_by_pair = {(c.membership_id, c.cycle_id): c for c in contributions}

    cycles = []
    if tontine_ids:
        cycles_query = db.query(TontineCycle).filter(TontineCycle.tontine_id.in_(tontine_ids))
        if tontine_id is not None:
            cycles_query = cycles_query.filter(TontineCycle.tontine_id == tontine_id)
        cycles = cycles_query.all()
    cycles_by_tontine: dict[int, list[TontineCycle]] = {}
    for cycle in cycles:
        cycles_by_tontine.setdefault(cycle.tontine_id, []).append(cycle)

    expected_due_cycles = 0
    cycles_completed = 0
    on_time_contributions = 0
    late_payments = 0
    missed_payments = 0

    for membership in membership_list:
        tontine_cycles = cycles_by_tontine.get(membership.tontine_id, [])
        for cycle in tontine_cycles:
            deadline = cycle.contribution_deadline or cycle.end_date
            if deadline is None:
                continue

            cutoff = deadline + timedelta(hours=int(cycle.grace_period_hours or 0))
            is_due = cycle.is_closed or cutoff <= now
            if not is_due:
                continue

            expected_due_cycles += 1
            contribution = contribution_by_pair.get((membership.id, cycle.id))
            if not contribution:
                late_payments += 1
                missed_payments += 1
                continue

            cycles_completed += 1
            if contribution.paid_at and contribution.paid_at <= cutoff:
                on_time_contributions += 1
            else:
                late_payments += 1

    debtor_membership_query = (
        db.query(Debt)
        .join(TontineMembership, TontineMembership.id == Debt.debtor_membership_id)
        .filter(TontineMembership.user_id == user_id)
    )
    if tontine_id is not None:
        debtor_membership_query = debtor_membership_query.filter(Debt.tontine_id == tontine_id)
    debts = debtor_membership_query.all()

    debts_created = len(debts)
    debts_repaid = sum(1 for debt in debts if debt.is_repaid)
    open_debts = debts_created - debts_repaid

    on_time_ratio = (on_time_contributions / expected_due_cycles) if expected_due_cycles else 1.0
    completion_ratio = (cycles_completed / expected_due_cycles) if expected_due_cycles else 1.0
    debt_repaid_ratio = (debts_repaid / debts_created) if debts_created else 1.0
    open_debt_ratio = (open_debts / debts_created) if debts_created else 0.0

    raw_score = (
        (on_time_ratio * 0.45)
        + (completion_ratio * 0.35)
        + (debt_repaid_ratio * 0.20)
        - (open_debt_ratio * 0.10)
    ) * 100.0
    reliability_score_percent = max(0, min(100, round(raw_score)))

    return {
        "user_id": user_id,
        "tontine_id": tontine_id,
        "reliability_score_percent": reliability_score_percent,
        "expected_due_cycles": expected_due_cycles,
        "cycles_completed": cycles_completed,
        "on_time_contributions": on_time_contributions,
        "late_payments": late_payments,
        "missed_payments": missed_payments,
        "debts_created": debts_created,
        "debts_repaid": debts_repaid,
        "open_debts": open_debts,
    }


def build_user_reliability_report(
    db: Session,
    *,
    user_id: int,
    tontine_id: int | None = None,
) -> dict:
    memberships_query = db.query(TontineMembership).filter(TontineMembership.user_id == user_id)
    if tontine_id is not None:
        memberships_query = memberships_query.filter(TontineMembership.tontine_id == tontine_id)
    memberships = memberships_query.all()

    return build_reliability_report_for_memberships(
        db,
        memberships,
        user_id=user_id,
        tontine_id=tontine_id,
    )
