from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from fastapi import HTTPException, status
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime

from app.models.transaction_ledger import TransactionLedger
from app.models.tontine import Tontine
from app.models.tontine_cycle import TontineCycle
from app.models.user import User
from app.models.tontine_membership import TontineMembership
from app.schemas.transaction_ledger import TransactionLedgerCreate


class TransactionLedgerService:
    """Service layer for transaction ledger business logic."""
    
    EVENT_TYPES = {
        'CONTRIBUTION': 'contribution',
        'PAYOUT': 'payout',
        'FEE': 'fee',
        'ADJUSTMENT': 'adjustment',
        'REFUND': 'refund'
    }
    
    @staticmethod
    def create_transaction(
        db: Session,
        transaction_data: TransactionLedgerCreate,
        current_user: User
    ) -> TransactionLedger:
        """
        Create a new transaction ledger entry.
        """
        # Validate tontine exists
        tontine = db.query(Tontine).filter(
            Tontine.id == transaction_data.tontine_id
        ).first()
        
        if not tontine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tontine not found"
            )
        
        # Check permission (owner or admin can create manual transactions)
        if tontine.owner_id != current_user.id:
            membership = db.query(TontineMembership).filter(
                and_(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.tontine_id == tontine.id,
                    TontineMembership.role == "admin"
                )
            ).first()
            
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only owner or admin can create manual transactions"
                )
        
        # Validate cycle if provided
        if transaction_data.cycle_id:
            cycle = db.query(TontineCycle).filter(
                TontineCycle.id == transaction_data.cycle_id,
                TontineCycle.tontine_id == tontine.id
            ).first()
            
            if not cycle:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cycle not found in this tontine"
                )
        
        # Validate user if provided
        if transaction_data.user_id:
            user = db.query(User).filter(User.id == transaction_data.user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        
        # Create transaction
        transaction = TransactionLedger(
            tontine_id=transaction_data.tontine_id,
            cycle_id=transaction_data.cycle_id,
            user_id=transaction_data.user_id,
            event_type=transaction_data.event_type,
            amount=transaction_data.amount,
            description=transaction_data.description
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        return transaction
    
    @staticmethod
    def log_contribution(
        db: Session,
        tontine_id: int,
        cycle_id: int,
        user_id: int,
        amount: Decimal,
        description: Optional[str] = None
    ) -> TransactionLedger:
        """
        Log a contribution transaction (automatically called when contribution is created).
        """
        membership = db.query(TontineMembership).filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.user_id == user_id,
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found for contribution ledger entry",
            )

        transaction = TransactionLedger(
            tontine_id=tontine_id,
            cycle_id=cycle_id,
            membership_id=membership.id,
            entry_type=TransactionLedgerService.EVENT_TYPES['CONTRIBUTION'],
            amount=amount,
            description=description or f"Contribution for cycle"
        )
        
        db.add(transaction)
        db.flush()
        
        return transaction
    
    @staticmethod
    def log_payout(
        db: Session,
        tontine_id: int,
        cycle_id: int,
        user_id: int,
        amount: Decimal,
        description: Optional[str] = None
    ) -> TransactionLedger:
        """
        Log a payout transaction (automatically called when payout is created).
        """
        membership = db.query(TontineMembership).filter(
            TontineMembership.tontine_id == tontine_id,
            TontineMembership.user_id == user_id,
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found for payout ledger entry",
            )

        transaction = TransactionLedger(
            tontine_id=tontine_id,
            cycle_id=cycle_id,
            membership_id=membership.id,
            entry_type=TransactionLedgerService.EVENT_TYPES['PAYOUT'],
            amount=amount,
            description=description or f"Payout for cycle"
        )
        
        db.add(transaction)
        db.flush()
        
        return transaction
    
    @staticmethod
    def get_tontine_transactions(
        db: Session,
        tontine_id: int,
        current_user: User,
        skip: int = 0,
        limit: int = 100,
        event_type: Optional[str] = None,
        cycle_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get transactions for a tontine with filters.
        """
        # Check access
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tontine not found"
            )
        
        if tontine.owner_id != current_user.id:
            membership = db.query(TontineMembership).filter(
                and_(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.tontine_id == tontine_id
                )
            ).first()
            
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this tontine"
                )
        
        # Build query
        query = db.query(
            TransactionLedger,
            TontineCycle.cycle_number,
            User.name.label("user_name"),
            User.phone.label("user_phone")
        ).outerjoin(
            TontineCycle,
            TontineCycle.id == TransactionLedger.cycle_id
        ).outerjoin(
            User,
            User.id == TransactionLedger.user_id
        ).filter(
            TransactionLedger.tontine_id == tontine_id
        )
        
        # Apply filters
        if event_type:
            query = query.filter(TransactionLedger.event_type == event_type)
        if cycle_id:
            query = query.filter(TransactionLedger.cycle_id == cycle_id)
        if user_id:
            query = query.filter(TransactionLedger.user_id == user_id)
        
        # Apply pagination
        transactions = query.order_by(
            TransactionLedger.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        result = []
        for transaction, cycle_number, user_name, user_phone in transactions:
            result.append({
                "id": transaction.id,
                "tontine_id": transaction.tontine_id,
                "cycle_id": transaction.cycle_id,
                "cycle_number": cycle_number,
                "user_id": transaction.user_id,
                "user_name": user_name,
                "user_phone": user_phone,
                "event_type": transaction.event_type,
                "amount": transaction.amount,
                "description": transaction.description,
                "created_at": transaction.created_at
            })
        
        return result
    
    @staticmethod
    def get_transaction_summary(
        db: Session,
        tontine_id: int,
        current_user: User
    ) -> Dict[str, Any]:
        """
        Get transaction summary for a tontine.
        """
        # Check access
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tontine not found"
            )
        
        if tontine.owner_id != current_user.id:
            membership = db.query(TontineMembership).filter(
                and_(
                    TontineMembership.user_id == current_user.id,
                    TontineMembership.tontine_id == tontine_id
                )
            ).first()
            
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this tontine"
                )
        
        # Get totals by event type
        contributions = db.query(func.sum(TransactionLedger.amount)).filter(
            TransactionLedger.tontine_id == tontine_id,
            TransactionLedger.event_type == TransactionLedgerService.EVENT_TYPES['CONTRIBUTION']
        ).scalar() or Decimal('0')
        
        payouts = db.query(func.sum(TransactionLedger.amount)).filter(
            TransactionLedger.tontine_id == tontine_id,
            TransactionLedger.event_type == TransactionLedgerService.EVENT_TYPES['PAYOUT']
        ).scalar() or Decimal('0')
        
        fees = db.query(func.sum(TransactionLedger.amount)).filter(
            TransactionLedger.tontine_id == tontine_id,
            TransactionLedger.event_type == TransactionLedgerService.EVENT_TYPES['FEE']
        ).scalar() or Decimal('0')
        
        total_count = db.query(TransactionLedger).filter(
            TransactionLedger.tontine_id == tontine_id
        ).count()
        
        last_transaction = db.query(TransactionLedger).filter(
            TransactionLedger.tontine_id == tontine_id
        ).order_by(TransactionLedger.created_at.desc()).first()
        
        return {
            "tontine_id": tontine_id,
            "tontine_name": tontine.name,
            "total_contributions": contributions,
            "total_payouts": payouts,
            "total_fees": fees,
            "balance": contributions - payouts - fees,
            "transaction_count": total_count,
            "last_transaction_date": last_transaction.created_at if last_transaction else None
        }
    
    @staticmethod
    def get_user_transactions(
        db: Session,
        user_id: int,
        current_user: User,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get all transactions for a specific user.
        """
        # Check permission (users can only see their own transactions unless admin)
        if user_id != current_user.id:
            # Could add admin check here
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own transactions"
            )
        
        transactions = db.query(
            TransactionLedger,
            Tontine.name.label("tontine_name"),
            TontineCycle.cycle_number
        ).join(
            Tontine,
            Tontine.id == TransactionLedger.tontine_id
        ).outerjoin(
            TontineCycle,
            TontineCycle.id == TransactionLedger.cycle_id
        ).filter(
            TransactionLedger.user_id == user_id
        ).order_by(
            TransactionLedger.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        result = []
        for transaction, tontine_name, cycle_number in transactions:
            result.append({
                "id": transaction.id,
                "tontine_id": transaction.tontine_id,
                "tontine_name": tontine_name,
                "cycle_id": transaction.cycle_id,
                "cycle_number": cycle_number,
                "event_type": transaction.event_type,
                "amount": transaction.amount,
                "description": transaction.description,
                "created_at": transaction.created_at
            })
        
        return result
