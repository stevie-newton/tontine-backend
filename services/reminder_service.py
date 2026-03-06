from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.contribution import Contribution
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.services.sms_service import SMSService


def list_pre_deadline_sms_targets(db: Session, *, now: datetime | None = None) -> dict:
    """Return cycles and members that are due for pre-deadline reminder SMS."""
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    lookahead = timedelta(hours=max(1, int(settings.AUTO_REMINDER_LOOKAHEAD_HOURS)))
    window_end = current_time + lookahead

    cycles = (
        db.query(TontineCycle)
        .filter(
            TontineCycle.is_closed.is_(False),
            TontineCycle.pre_deadline_sms_sent_at.is_(None),
            func.coalesce(TontineCycle.contribution_deadline, TontineCycle.end_date) > current_time,
            func.coalesce(TontineCycle.contribution_deadline, TontineCycle.end_date) <= window_end,
        )
        .all()
    )

    payload_cycles: list[dict] = []
    total_targets = 0

    for cycle in cycles:
        deadline = cycle.contribution_deadline or cycle.end_date
        if deadline is None:
            continue

        tontine = db.query(Tontine).filter(Tontine.id == cycle.tontine_id).first()
        if not tontine:
            continue

        paid_membership_ids = {
            membership_id
            for (membership_id,) in (
                db.query(Contribution.membership_id)
                .filter(
                    Contribution.cycle_id == cycle.id,
                    Contribution.is_confirmed.is_(True),
                )
                .all()
            )
        }

        members = (
            db.query(TontineMembership.id, TontineMembership.user_id, User.name, User.phone)
            .join(User, User.id == TontineMembership.user_id)
            .filter(
                TontineMembership.tontine_id == tontine.id,
                TontineMembership.is_active.is_(True),
            )
            .all()
        )

        targets: list[dict] = []
        for membership_id, user_id, member_name, member_phone in members:
            if cycle.payout_member_id and user_id == cycle.payout_member_id:
                continue
            if membership_id in paid_membership_ids:
                continue
            if not member_phone:
                continue
            targets.append(
                {
                    "membership_id": membership_id,
                    "user_id": user_id,
                    "name": member_name,
                    "phone": member_phone,
                }
            )

        total_targets += len(targets)
        payload_cycles.append(
            {
                "cycle_id": cycle.id,
                "tontine_id": tontine.id,
                "tontine_name": tontine.name,
                "cycle_number": cycle.cycle_number,
                "deadline": deadline,
                "targets_count": len(targets),
                "targets": targets,
            }
        )

    return {
        "window_start": current_time,
        "window_end": window_end,
        "lookahead_hours": int(settings.AUTO_REMINDER_LOOKAHEAD_HOURS),
        "cycles_count": len(payload_cycles),
        "targets_count": total_targets,
        "cycles": payload_cycles,
    }


def send_pre_deadline_sms_reminders(db: Session, *, now: datetime | None = None) -> dict:
    """Send one-time SMS reminders for cycles due within the configured lookahead window."""
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    if not SMSService.is_configured():
        return {
            "sms_configured": False,
            "cycles_checked": 0,
            "cycles_marked": 0,
            "sms_sent": 0,
            "sms_failed": 0,
        }

    preview = list_pre_deadline_sms_targets(db, now=current_time)
    cycles = preview["cycles"]

    sms_sent = 0
    sms_failed = 0
    cycles_marked = 0

    for cycle_info in cycles:
        for target in cycle_info["targets"]:
            try:
                SMSService.send_sms(
                    target["phone"],
                    (
                        f"Reminder: contribute for '{cycle_info['tontine_name']}' "
                        f"before {cycle_info['deadline'].strftime('%Y-%m-%d %H:%M')}."
                    ),
                )
                sms_sent += 1
            except Exception:
                sms_failed += 1

        cycle = db.query(TontineCycle).filter(TontineCycle.id == cycle_info["cycle_id"]).first()
        if cycle:
            cycle.pre_deadline_sms_sent_at = current_time
            cycles_marked += 1

    if cycles_marked:
        db.commit()

    return {
        "sms_configured": True,
        "cycles_checked": len(cycles),
        "cycles_marked": cycles_marked,
        "sms_sent": sms_sent,
        "sms_failed": sms_failed,
    }
