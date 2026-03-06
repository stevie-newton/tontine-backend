# tests/helpers.py
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership


def seed_tontine_with_one_cycle(db, owner_id: int, member_user_id: int):
    tontine = Tontine(
        name="Test Tontine",
        contribution_amount=Decimal("25.00"),
        total_cycles=3,
        current_cycle=1,
        status=TontineStatus.ACTIVE.value if hasattr(TontineStatus, "ACTIVE") else "active",
        frequency="weekly",
        owner_id=owner_id,
    )
    db.add(tontine)
    db.commit()
    db.refresh(tontine)

    start = datetime.now(timezone.utc)
    cycle = TontineCycle(
        tontine_id=tontine.id,
        cycle_number=1,
        start_date=start,
        end_date=start + timedelta(days=7),
        is_closed=False,
        payout_member_id=None,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)

    membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=member_user_id,
        is_active=True,
        role="member",
        payout_position=1,  # so determine_payout_member can find them
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    return tontine, cycle, membership