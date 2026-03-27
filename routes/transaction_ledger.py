from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.transaction_ledger import (
    TransactionLedgerCreate,
    TransactionLedgerResponse,
    TransactionLedgerWithDetails,
    TransactionSummary
)
from app.services.transaction_ledger_service import TransactionLedgerService

router = APIRouter(prefix="/transactions", tags=["transactions"])


# -------------------------
# Create manual transaction (admin only)
# -------------------------
@router.post("/", response_model=TransactionLedgerResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_data: TransactionLedgerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a manual transaction entry (admin only).
    """
    transaction = TransactionLedgerService.create_transaction(
        db=db,
        transaction_data=transaction_data,
        current_user=current_user
    )
    return transaction


# -------------------------
# Get transactions for a tontine
# -------------------------
@router.get("/tontine/{tontine_id}", response_model=List[TransactionLedgerWithDetails])
def get_tontine_transactions(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    entry_type: Optional[str] = None,
    cycle_id: Optional[int] = None,
    user_id: Optional[int] = None
):
    """
    Get all transactions for a specific tontine with optional filters.
    """
    transactions = TransactionLedgerService.get_tontine_transactions(
        db=db,
        tontine_id=tontine_id,
        current_user=current_user,
        skip=skip,
        limit=limit,
        entry_type=entry_type,
        cycle_id=cycle_id,
        user_id=user_id
    )
    return transactions


# -------------------------
# Get transaction summary for a tontine
# -------------------------
@router.get("/tontine/{tontine_id}/summary", response_model=TransactionSummary)
def get_tontine_transaction_summary(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get summary of all transactions for a tontine.
    """
    summary = TransactionLedgerService.get_transaction_summary(
        db=db,
        tontine_id=tontine_id,
        current_user=current_user
    )
    return summary


# -------------------------
# Export transaction ledger CSV for a tontine (owner only)
# -------------------------
@router.get("/tontine/{tontine_id}/export/csv")
def export_tontine_transactions_csv(
    tontine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_text = TransactionLedgerService.export_tontine_transactions_csv(
        db=db,
        tontine_id=tontine_id,
        current_user=current_user,
    )

    file_like = io.BytesIO(csv_text.encode("utf-8"))
    return StreamingResponse(
        file_like,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="tontine_{tontine_id}_ledger.csv"',
        },
    )


# -------------------------
# Get user transactions
# -------------------------
@router.get("/user/{user_id}", response_model=List[TransactionLedgerWithDetails])
def get_user_transactions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get all transactions for a specific user.
    """
    transactions = TransactionLedgerService.get_user_transactions(
        db=db,
        user_id=user_id,
        current_user=current_user,
        skip=skip,
        limit=limit
    )
    return transactions


# -------------------------
# Get my transactions
# -------------------------
@router.get("/me", response_model=List[TransactionLedgerWithDetails])
def get_my_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get all transactions for the current user.
    """
    transactions = TransactionLedgerService.get_user_transactions(
        db=db,
        user_id=current_user.id,
        current_user=current_user,
        skip=skip,
        limit=limit
    )
    return transactions
