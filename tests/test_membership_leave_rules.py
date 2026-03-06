from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.tontine_membership import TontineMembership
from app.models.user import User


def _seed_member_tontine(db_session, member_user_id: int, status: str) -> tuple[Tontine, TontineMembership]:
    owner = User(name="Owner", phone="3333333333", hashed_password="fake")
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)

    tontine = Tontine(
        name="Leave Rule",
        contribution_amount=Decimal("25.00"),
        total_cycles=3,
        current_cycle=1,
        status=status,
        frequency="weekly",
        owner_id=owner.id,
    )
    db_session.add(tontine)
    db_session.commit()
    db_session.refresh(tontine)

    membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=member_user_id,
        role="member",
        is_active=True,
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(membership)
    return tontine, membership


def test_member_can_leave_when_tontine_is_draft(client, db_session, current_user):
    tontine, membership = _seed_member_tontine(db_session, current_user.id, status="draft")

    response = client.delete(f"/tontine-memberships/{membership.id}")
    assert response.status_code == 204, response.text


def test_member_can_leave_when_cycle_one_not_started(client, db_session, current_user):
    tontine, membership = _seed_member_tontine(db_session, current_user.id, status="active")
    future = datetime.now(timezone.utc) + timedelta(days=2)
    cycle = TontineCycle(
        tontine_id=tontine.id,
        cycle_number=1,
        start_date=future,
        end_date=future + timedelta(days=7),
        is_closed=False,
    )
    db_session.add(cycle)
    db_session.commit()

    response = client.delete(f"/tontine-memberships/{membership.id}")
    assert response.status_code == 204, response.text


def test_member_cannot_leave_after_cycle_one_started(client, db_session, current_user):
    tontine, membership = _seed_member_tontine(db_session, current_user.id, status="active")
    past = datetime.now(timezone.utc) - timedelta(days=2)
    cycle = TontineCycle(
        tontine_id=tontine.id,
        cycle_number=1,
        start_date=past,
        end_date=past + timedelta(days=7),
        is_closed=False,
    )
    db_session.add(cycle)
    db_session.commit()

    response = client.delete(f"/tontine-memberships/{membership.id}")
    assert response.status_code == 409, response.text
    assert "before the tontine starts" in response.json()["detail"].lower()
