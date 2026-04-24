from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.contribution import Contribution
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User
from app.schemas.reminder import PreDeadlineReminder, PreDeadlineRemindersResponse

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("/pre-deadline/me", response_model=PreDeadlineRemindersResponse)
@router.get(
    "/pre-deadline/me/",
    response_model=PreDeadlineRemindersResponse,
    include_in_schema=False,
)
def list_my_pre_deadline_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Notification-friendly reminders (no SMS).

    Returns cycles where the current user:
    - is an active member
    - is not the payout member for the cycle
    - has NOT yet submitted a confirmed contribution for that cycle
    - and the cycle deadline is either overdue or within the lookahead window
    """
    now = datetime.now(timezone.utc)
    lookahead_hours = max(1, int(settings.AUTO_REMINDER_LOOKAHEAD_HOURS))
    window_end = now + timedelta(hours=lookahead_hours)

    deadline_expr = func.coalesce(TontineCycle.contribution_deadline, TontineCycle.end_date)

    confirmed_exists = (
        db.query(Contribution.id)
        .filter(
            Contribution.cycle_id == TontineCycle.id,
            Contribution.membership_id == TontineMembership.id,
            Contribution.is_confirmed.is_(True),
        )
        .exists()
    )

    rows = (
        db.query(
            TontineCycle.id.label("cycle_id"),
            TontineCycle.tontine_id.label("tontine_id"),
            Tontine.name.label("tontine_name"),
            TontineCycle.cycle_number.label("cycle_number"),
            deadline_expr.label("deadline"),
        )
        .join(Tontine, Tontine.id == TontineCycle.tontine_id)
        .join(
            TontineMembership,
            and_(
                TontineMembership.tontine_id == Tontine.id,
                TontineMembership.user_id == current_user.id,
                TontineMembership.is_active.is_(True),
            ),
        )
        .filter(
            TontineCycle.is_closed.is_(False),
            deadline_expr.isnot(None),
            deadline_expr <= window_end,
            or_(
                TontineCycle.payout_member_id.is_(None),
                TontineCycle.payout_member_id != current_user.id,
            ),
            ~confirmed_exists,
        )
        .order_by(deadline_expr.asc())
        .all()
    )

    reminders: list[PreDeadlineReminder] = []
    for cycle_id, tontine_id, tontine_name, cycle_number, deadline in rows:
        seconds_until_due = (deadline - now).total_seconds()
        is_overdue = seconds_until_due < 0
        hours_remaining = int(max(0, seconds_until_due // 3600))
        hours_overdue = int(max(0, (now - deadline).total_seconds() // 3600))
        reminders.append(
            PreDeadlineReminder(
                cycle_id=cycle_id,
                tontine_id=tontine_id,
                tontine_name=tontine_name,
                cycle_number=cycle_number,
                deadline=deadline,
                hours_remaining=hours_remaining,
                is_overdue=is_overdue,
                hours_overdue=hours_overdue,
            )
        )

    return PreDeadlineRemindersResponse(
        lookahead_hours=lookahead_hours,
        server_time=now,
        reminders=reminders,
    )
