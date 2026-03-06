from decimal import Decimal

from app.models.contribution import Contribution
from app.models.tontine import Tontine
from tests.helpers import seed_tontine_with_one_cycle


def test_owner_can_delete_draft_tontine(client, db_session, current_user):
    tontine = Tontine(
        name="Draft Delete",
        contribution_amount=Decimal("25.00"),
        total_cycles=3,
        current_cycle=1,
        status="draft",
        frequency="weekly",
        owner_id=current_user.id,
    )
    db_session.add(tontine)
    db_session.commit()
    db_session.refresh(tontine)

    response = client.delete(f"/tontines/{tontine.id}")
    assert response.status_code == 204, response.text


def test_owner_can_delete_non_draft_tontine_when_no_contributions(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )
    # helper creates active tontine and one cycle; no contributions yet
    response = client.delete(f"/tontines/{tontine.id}")
    assert response.status_code == 204, response.text


def test_owner_cannot_delete_non_draft_tontine_with_contributions(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    contribution = Contribution(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        transaction_reference="REF-DEL-001",
        beneficiary_decision="pending",
        is_confirmed=False,
        ledger_entry_created=False,
    )
    db_session.add(contribution)
    db_session.commit()

    response = client.delete(f"/tontines/{tontine.id}")
    assert response.status_code == 409, response.text
    assert "cannot be deleted" in response.json()["detail"].lower()
