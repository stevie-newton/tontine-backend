from app.models.support_ticket import SupportTicket


def test_create_support_ticket_stores_record(client, db_session, current_user):
    payload = {
        "message": "I cannot submit my contribution.",
        "tontine_id": 5,
        "screenshot_url": "https://example.com/screen.png",
    }
    response = client.post("/support/ticket", json=payload)
    assert response.status_code == 201, response.text

    body = response.json()
    assert body["user_id"] == current_user.id
    assert body["message"] == payload["message"]
    assert body["tontine_id"] == payload["tontine_id"]
    assert body["status"] == "open"
    assert "created_at" in body

    ticket = db_session.query(SupportTicket).filter(SupportTicket.id == body["id"]).first()
    assert ticket is not None
    assert ticket.user_id == current_user.id
    assert ticket.message == payload["message"]
    assert ticket.status == "open"


def test_create_support_ticket_requires_message(client):
    response = client.post("/support/ticket", json={"message": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "message is required"
