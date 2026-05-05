from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_global_admin
from app.models.contribution import Contribution
from app.models.debt import Debt
from app.models.payout import Payout
from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.reminder_service import list_pre_deadline_sms_targets, send_pre_deadline_sms_reminders


router = APIRouter(prefix="/admin/stats", tags=["admin"])


@router.get("/tontines")
def tontine_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    total = db.query(func.count(Tontine.id)).scalar() or 0

    grouped = (
        db.query(Tontine.status, func.count(Tontine.id))
        .group_by(Tontine.status)
        .all()
    )
    by_status = {
        TontineStatus.DRAFT.value: 0,
        TontineStatus.ACTIVE.value: 0,
        TontineStatus.COMPLETED.value: 0,
    }
    for status_value, count in grouped:
        key = status_value.value if hasattr(status_value, "value") else str(status_value)
        by_status[key] = int(count)

    now = datetime.now(timezone.utc)
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    created_last_7_days = (
        db.query(func.count(Tontine.id))
        .filter(Tontine.created_at >= last_7)
        .scalar()
        or 0
    )
    created_last_30_days = (
        db.query(func.count(Tontine.id))
        .filter(Tontine.created_at >= last_30)
        .scalar()
        or 0
    )

    return {
        "total": int(total),
        "by_status": by_status,
        "created_last_7_days": int(created_last_7_days),
        "created_last_30_days": int(created_last_30_days),
    }


@router.get("/tontines/list")
def tontine_directory(
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    safe_limit = max(1, min(int(limit), 100))

    active_members_subquery = (
        db.query(
            TontineMembership.tontine_id.label("tontine_id"),
            func.count(TontineMembership.id).label("active_members_count"),
        )
        .filter(TontineMembership.is_active.is_(True))
        .group_by(TontineMembership.tontine_id)
        .subquery()
    )

    rows = (
        db.query(
            Tontine.id,
            Tontine.name,
            Tontine.status,
            Tontine.current_cycle,
            Tontine.total_cycles,
            Tontine.contribution_amount,
            Tontine.created_at,
            Tontine.owner_id,
            User.name.label("owner_name"),
            func.coalesce(active_members_subquery.c.active_members_count, 0).label("active_members_count"),
        )
        .join(User, User.id == Tontine.owner_id)
        .outerjoin(active_members_subquery, active_members_subquery.c.tontine_id == Tontine.id)
        .order_by(Tontine.created_at.desc())
        .limit(safe_limit)
        .all()
    )

    items = []
    for row in rows:
        status_value = row.status.value if hasattr(row.status, "value") else str(row.status)
        items.append(
            {
                "id": row.id,
                "name": row.name,
                "status": status_value,
                "current_cycle": row.current_cycle,
                "total_cycles": row.total_cycles,
                "contribution_amount": float(row.contribution_amount),
                "created_at": row.created_at,
                "owner_id": row.owner_id,
                "owner_name": row.owner_name,
                "active_members_count": int(row.active_members_count or 0),
            }
        )

    return {
        "count": len(items),
        "items": items,
    }


@router.get("/overview")
def overview_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    now = datetime.now(timezone.utc)
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    users_total = db.query(func.count(User.id)).scalar() or 0
    users_last_7 = db.query(func.count(User.id)).filter(User.created_at >= last_7).scalar() or 0
    users_last_30 = db.query(func.count(User.id)).filter(User.created_at >= last_30).scalar() or 0
    users_global_admins = db.query(func.count(User.id)).filter(User.is_global_admin.is_(True)).scalar() or 0

    tontine_total = db.query(func.count(Tontine.id)).scalar() or 0
    status_rows = db.query(Tontine.status, func.count(Tontine.id)).group_by(Tontine.status).all()
    by_status = {TontineStatus.DRAFT.value: 0, TontineStatus.ACTIVE.value: 0, TontineStatus.COMPLETED.value: 0}
    for status_value, count in status_rows:
        key = status_value.value if hasattr(status_value, "value") else str(status_value)
        by_status[key] = int(count)
    tontines_last_7 = db.query(func.count(Tontine.id)).filter(Tontine.created_at >= last_7).scalar() or 0
    tontines_last_30 = db.query(func.count(Tontine.id)).filter(Tontine.created_at >= last_30).scalar() or 0

    contributions_last_30 = (
        db.query(func.count(Contribution.id))
        .filter(and_(Contribution.paid_at.isnot(None), Contribution.paid_at >= last_30))
        .scalar()
        or 0
    )
    contribution_volume_last_30 = (
        db.query(func.coalesce(func.sum(Contribution.amount), 0))
        .filter(and_(Contribution.paid_at.isnot(None), Contribution.paid_at >= last_30))
        .scalar()
        or 0
    )
    payout_volume_last_30 = (
        db.query(func.coalesce(func.sum(Payout.amount), 0))
        .filter(
            and_(
                Payout.is_processed.is_(True),
                func.coalesce(Payout.processed_at, Payout.created_at) >= last_30,
            )
        )
        .scalar()
        or 0
    )
    open_debts_count = db.query(func.count(Debt.id)).filter(Debt.is_repaid.is_(False)).scalar() or 0
    open_debts_amount = db.query(func.coalesce(func.sum(Debt.amount), 0)).filter(Debt.is_repaid.is_(False)).scalar() or 0
    repaid_debts_count = db.query(func.count(Debt.id)).filter(Debt.is_repaid.is_(True)).scalar() or 0
    repaid_debts_amount = db.query(func.coalesce(func.sum(Debt.amount), 0)).filter(Debt.is_repaid.is_(True)).scalar() or 0

    # Operational risk: open cycles not fully funded (excluding beneficiary contribution)
    open_cycles = db.query(TontineCycle).filter(TontineCycle.is_closed.is_(False)).all()
    cycles_blocked_count = 0
    for cycle in open_cycles:
        active_memberships = (
            db.query(TontineMembership.id)
            .filter(
                TontineMembership.tontine_id == cycle.tontine_id,
                TontineMembership.is_active.is_(True),
            )
            .all()
        )
        member_ids = {m_id for (m_id,) in active_memberships}
        beneficiary_membership = (
            db.query(TontineMembership.id)
            .filter(
                TontineMembership.tontine_id == cycle.tontine_id,
                TontineMembership.user_id == cycle.payout_member_id,
                TontineMembership.is_active.is_(True),
            )
            .first()
        )
        if beneficiary_membership:
            member_ids.discard(beneficiary_membership[0])
        expected = len(member_ids)
        confirmed = (
            db.query(func.count(Contribution.id))
            .filter(
                Contribution.cycle_id == cycle.id,
                Contribution.is_confirmed.is_(True),
                Contribution.membership_id.in_(member_ids) if member_ids else False,
            )
            .scalar()
            or 0
        )
        if confirmed < expected:
            cycles_blocked_count += 1

    members_with_open_debt = (
        db.query(func.count(func.distinct(Debt.debtor_membership_id)))
        .filter(Debt.is_repaid.is_(False))
        .scalar()
        or 0
    )
    repeated_defaulters = (
        db.query(Debt.debtor_membership_id)
        .filter(Debt.is_repaid.is_(False))
        .group_by(Debt.debtor_membership_id)
        .having(func.count(Debt.id) >= 2)
        .count()
    )

    return {
        "users": {
            "total": int(users_total),
            "new_last_7_days": int(users_last_7),
            "new_last_30_days": int(users_last_30),
            "global_admins": int(users_global_admins),
        },
        "tontines": {
            "total": int(tontine_total),
            "by_status": by_status,
            "created_last_7_days": int(tontines_last_7),
            "created_last_30_days": int(tontines_last_30),
        },
        "financial": {
            "contributions_last_30_days": int(contributions_last_30),
            "contribution_volume_last_30_days": float(contribution_volume_last_30),
            "payout_volume_last_30_days": float(payout_volume_last_30),
            "open_debts_count": int(open_debts_count),
            "open_debts_amount": float(open_debts_amount),
            "repaid_debts_count": int(repaid_debts_count),
            "repaid_debts_amount": float(repaid_debts_amount),
        },
        "risk": {
            "cycles_blocked_count": int(cycles_blocked_count),
            "members_with_open_debt": int(members_with_open_debt),
            "repeated_defaulters": int(repeated_defaulters),
        },
    }


@router.get("/reminders/pre-deadline/preview")
def preview_pre_deadline_reminders(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    return list_pre_deadline_sms_targets(db)


@router.post("/reminders/pre-deadline/send")
def send_pre_deadline_reminders_now(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    return send_pre_deadline_sms_reminders(db)
