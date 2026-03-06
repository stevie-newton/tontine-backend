from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.services.email_service import EmailService


router = APIRouter(prefix="/support", tags=["support"])


class SupportTicketCreate(BaseModel):
    message: str
    tontine_id: int | None = None
    screenshot_url: str | None = None


@router.post("/ticket", status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="message is required",
        )

    ticket = SupportTicket(
        user_id=current_user.id,
        tontine_id=payload.tontine_id,
        message=message,
        screenshot_url=payload.screenshot_url.strip() if payload.screenshot_url else None,
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    email_sent = False
    email_error: str | None = None
    if EmailService.is_configured():
        body = (
            "New support ticket submitted.\n\n"
            f"Ticket ID: {ticket.id}\n"
            f"User ID: {ticket.user_id}\n"
            f"User Name: {current_user.name}\n"
            f"User Phone: {current_user.phone}\n"
            f"Tontine ID: {ticket.tontine_id or '-'}\n"
            f"Screenshot URL: {ticket.screenshot_url or '-'}\n"
            f"Status: {ticket.status}\n\n"
            f"Message:\n{ticket.message}\n"
        )
        try:
            EmailService.send_support_ticket_email(
                subject=f"[Support Ticket #{ticket.id}] User {current_user.id}",
                body=body,
            )
            email_sent = True
        except Exception as exc:
            email_error = str(exc)

    return {
        "id": ticket.id,
        "user_id": ticket.user_id,
        "tontine_id": ticket.tontine_id,
        "message": ticket.message,
        "screenshot_url": ticket.screenshot_url,
        "status": ticket.status,
        "created_at": ticket.created_at,
        "email_sent": email_sent,
        "email_error": email_error,
    }
