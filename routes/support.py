from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_global_admin, get_current_user_optional
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.services.email_service import EmailService


router = APIRouter(prefix="/support", tags=["support"])


class SupportTicketCreate(BaseModel):
    message: str
    requester_name: str | None = Field(default=None, max_length=100)
    requester_phone: str | None = Field(default=None, max_length=20)
    tontine_id: int | None = None
    screenshot_url: str | None = None


@router.get("/contact")
def get_support_contact():
    return {
        "email": settings.SUPPORT_PUBLIC_EMAIL or None,
        "phone": settings.SUPPORT_PUBLIC_PHONE or None,
        "address": settings.SUPPORT_PUBLIC_ADDRESS or None,
    }


@router.post("/ticket", status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    message = payload.message.strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="message is required",
        )

    requester_name = current_user.name if current_user else (payload.requester_name.strip() if payload.requester_name else "")
    requester_phone = current_user.phone if current_user else (payload.requester_phone.strip() if payload.requester_phone else "")

    if not requester_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="requester_name is required",
        )
    if not requester_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="requester_phone is required",
        )

    ticket = SupportTicket(
        user_id=current_user.id if current_user else None,
        requester_name=requester_name,
        requester_phone=requester_phone,
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
            f"User ID: {ticket.user_id or '-'}\n"
            f"Requester Name: {ticket.requester_name or '-'}\n"
            f"Requester Phone: {ticket.requester_phone or '-'}\n"
            f"Tontine ID: {ticket.tontine_id or '-'}\n"
            f"Screenshot URL: {ticket.screenshot_url or '-'}\n"
            f"Status: {ticket.status}\n\n"
            f"Message:\n{ticket.message}\n"
        )
        try:
            EmailService.send_support_ticket_email(
                subject=f"[Support Ticket #{ticket.id}] {ticket.requester_name or 'Guest'}",
                body=body,
            )
            email_sent = True
        except Exception as exc:
            email_error = str(exc)

    return {
        "id": ticket.id,
        "user_id": ticket.user_id,
        "requester_name": ticket.requester_name,
        "requester_phone": ticket.requester_phone,
        "tontine_id": ticket.tontine_id,
        "message": ticket.message,
        "screenshot_url": ticket.screenshot_url,
        "status": ticket.status,
        "created_at": ticket.created_at,
        "email_sent": email_sent,
        "email_error": email_error,
    }


class AdminSupportTicket(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requester_name: str | None
    requester_phone: str | None
    message: str
    status: str
    created_at: datetime
    tontine_id: int | None


class AdminSupportTicketPage(BaseModel):
    items: list[AdminSupportTicket]
    next_before_id: int | None


class SupportTicketStatusUpdate(BaseModel):
    status: Literal["open", "resolved"]


@router.get("/tickets", response_model=AdminSupportTicketPage)
def list_support_tickets(
    response: Response,
    ticket_status: Literal["open", "resolved", "all"] = Query("open", alias="status"),
    before_id: int | None = Query(None, gt=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    response.headers["Cache-Control"] = "private, no-store"
    query = db.query(SupportTicket)
    if ticket_status != "all":
        query = query.filter(SupportTicket.status == ticket_status)
    if before_id is not None:
        query = query.filter(SupportTicket.id < before_id)
    rows = query.order_by(SupportTicket.id.desc()).limit(limit + 1).all()
    return {
        "items": rows[:limit],
        "next_before_id": rows[limit - 1].id if len(rows) > limit else None,
    }


@router.patch("/tickets/{ticket_id}", response_model=AdminSupportTicket)
def update_support_ticket_status(
    ticket_id: int,
    payload: SupportTicketStatusUpdate,
    response: Response,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_global_admin),
):
    response.headers["Cache-Control"] = "private, no-store"
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)
    return ticket
