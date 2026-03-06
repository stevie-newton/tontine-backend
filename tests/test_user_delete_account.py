from decimal import Decimal

from app.models.tontine import Tontine, TontineStatus
from app.models.tontine_membership import TontineMembership
from app.models.user import User


def test_delete_account_blocked_when_member_of_active_tontine(client, db_session, current_user):
    owner = User(name="Owner", phone="+237699000001", hashed_password="fake")
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)

    tontine = Tontine(
        name="Active Group",
        contribution_amount=Decimal("10000.00"),
        frequency="weekly",
        total_cycles=2,
        current_cycle=1,
        status=TontineStatus.ACTIVE,
        owner_id=owner.id,
    )
    db_session.add(tontine)
    db_session.commit()
    db_session.refresh(tontine)

    membership = TontineMembership(
        user_id=current_user.id,
        tontine_id=tontine.id,
        role="member",
        is_active=True,
    )
    db_session.add(membership)
    db_session.commit()

    response = client.delete("/users/me")
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot delete account while member of an active tontine group"


def test_delete_account_allowed_when_not_in_active_tontine(client, db_session, current_user):
    response = client.delete("/users/me")
    assert response.status_code == 200
    assert response.json()["message"] == "Account deleted successfully"

    deleted = db_session.query(User).filter(User.id == current_user.id).first()
    assert deleted is None
