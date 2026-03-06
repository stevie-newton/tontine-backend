from decimal import Decimal

from app.models.contribution import Contribution
from tests.helpers import seed_tontine_with_one_cycle


def test_cannot_remove_member_with_financial_records(client, db_session, current_user):
    tontine, cycle, membership = seed_tontine_with_one_cycle(
        db_session, owner_id=current_user.id, member_user_id=current_user.id
    )

    contribution = Contribution(
        membership_id=membership.id,
        cycle_id=cycle.id,
        amount=Decimal("25.00"),
        transaction_reference="REF-RM-001",
        beneficiary_decision="pending",
        is_confirmed=False,
        ledger_entry_created=False,
    )
    db_session.add(contribution)
    db_session.commit()

    response = client.delete(f"/tontine-memberships/{membership.id}")
    assert response.status_code == 409, response.text
    assert "financial records exist" in response.json()["detail"].lower()
