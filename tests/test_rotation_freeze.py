from decimal import Decimal

from app.models.tontine import Tontine
from app.models.tontine_membership import TontineMembership
from app.models.user import User


def _seed_tontine_with_three_members(db_session, owner: User):
    tontine = Tontine(
        name="Rotation Freeze Test",
        contribution_amount=Decimal("25.00"),
        total_cycles=3,
        current_cycle=1,
        status="draft",
        frequency="weekly",
        owner_id=owner.id,
    )
    db_session.add(tontine)
    db_session.commit()
    db_session.refresh(tontine)

    user_b = User(name="Member B", phone="1010101010", hashed_password="fake")
    user_c = User(name="Member C", phone="2020202020", hashed_password="fake")
    db_session.add_all([user_b, user_c])
    db_session.commit()
    db_session.refresh(user_b)
    db_session.refresh(user_c)

    owner_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=owner.id,
        role="member",
        is_active=True,
        payout_position=None,
    )
    member_b_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=user_b.id,
        role="member",
        is_active=True,
        payout_position=1,  # admin override: member B should be first
    )
    member_c_membership = TontineMembership(
        tontine_id=tontine.id,
        user_id=user_c.id,
        role="member",
        is_active=True,
        payout_position=None,
    )
    db_session.add_all([owner_membership, member_b_membership, member_c_membership])
    db_session.commit()
    db_session.refresh(owner_membership)
    db_session.refresh(member_b_membership)
    db_session.refresh(member_c_membership)

    return tontine, owner_membership, member_b_membership, member_c_membership


def test_generate_cycles_freezes_rotation_with_override(client, db_session, current_user):
    tontine, owner_m, member_b_m, member_c_m = _seed_tontine_with_three_members(db_session, current_user)

    r = client.post(f"/tontine-cycles/generate/{tontine.id}")
    assert r.status_code == 200, r.text
    cycles = r.json()
    assert len(cycles) == 3

    # Frozen rotation should be:
    # 1) member_b (override payout_position=1)
    # 2) owner (first unpinned by join order)
    # 3) member_c (next unpinned)
    assert [c["payout_member_id"] for c in cycles] == [
        member_b_m.user_id,
        owner_m.user_id,
        member_c_m.user_id,
    ]

    refreshed_owner = db_session.query(TontineMembership).filter(TontineMembership.id == owner_m.id).first()
    refreshed_b = db_session.query(TontineMembership).filter(TontineMembership.id == member_b_m.id).first()
    refreshed_c = db_session.query(TontineMembership).filter(TontineMembership.id == member_c_m.id).first()
    assert refreshed_b.rotation_position == 1
    assert refreshed_owner.rotation_position == 2
    assert refreshed_c.rotation_position == 3


def test_cannot_change_payout_position_after_start(client, db_session, current_user):
    tontine, owner_m, member_b_m, member_c_m = _seed_tontine_with_three_members(db_session, current_user)

    r_generate = client.post(f"/tontine-cycles/generate/{tontine.id}")
    assert r_generate.status_code == 200, r_generate.text

    r_update = client.put(
        f"/tontine-memberships/{member_c_m.id}",
        json={"payout_position": 2},
    )
    assert r_update.status_code == 409, r_update.text
    assert "after tontine has started" in r_update.json()["detail"].lower()
