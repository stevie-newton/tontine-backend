"""Exercise report authorization and persistence against in-memory SQLite only."""
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

os.environ['DATABASE_URL'] = 'sqlite://'
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import app.models
from app.core.database import Base, get_db
from app.core.dependencies import get_current_user
from app.models.support_ticket import SupportTicket
from app.routes.support import router


class AdminReportsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        self.app.include_router(router)

        def db():
            with self.sessions() as session:
                yield session

        self.app.dependency_overrides[get_db] = db
        self.client = TestClient(self.app)
        with self.sessions() as session:
            for index in range(5):
                session.add(SupportTicket(requester_name='Tester', requester_phone='+15145550123', message=f'Report {index}', status='resolved' if index == 0 else 'open'))
            session.commit()

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def authorize(self, admin):
        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, is_global_admin=admin)

    def test_guests_and_members_cannot_read_or_modify(self):
        for admin, expected in [(None, 401), (False, 403)]:
            if admin is not None:
                self.authorize(admin)
            self.assertEqual(self.client.get('/support/tickets').status_code, expected)
            self.assertEqual(self.client.patch('/support/tickets/1', json={'status': 'resolved'}).status_code, expected)
        with self.sessions() as db:
            self.assertEqual(db.get(SupportTicket, 2).status, 'open')

    def test_filter_pagination_and_private_response(self):
        self.authorize(True)
        response = self.client.get('/support/tickets?limit=2')
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response.headers['cache-control'])
        page = response.json()
        self.assertEqual([r['id'] for r in page['items']], [5, 4])
        self.assertEqual(page['next_before_id'], 4)
        next_page = self.client.get('/support/tickets?limit=2&before_id=4').json()
        self.assertEqual([r['id'] for r in next_page['items']], [3, 2])
        self.assertIsNone(next_page['next_before_id'])
        self.assertEqual(len(self.client.get('/support/tickets?status=resolved').json()['items']), 1)
        self.assertEqual(len(self.client.get('/support/tickets?status=all').json()['items']), 5)
        self.assertEqual(page['items'][0]['message'], 'Report 4')

    def test_resolve_reopen_and_validation(self):
        self.authorize(True)
        for state in ['resolved', 'open']:
            response = self.client.patch('/support/tickets/2', json={'status': state})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['status'], state)
            with self.sessions() as db:
                self.assertEqual(db.get(SupportTicket, 2).status, state)
                self.assertEqual(db.get(SupportTicket, 2).message, 'Report 1')
        self.assertEqual(self.client.patch('/support/tickets/2', json={'status': 'deleted'}).status_code, 422)
        self.assertEqual(self.client.patch('/support/tickets/99', json={'status': 'open'}).status_code, 404)
        for query in ['limit=0', 'limit=51', 'before_id=-1', 'status=invalid']:
            self.assertEqual(self.client.get('/support/tickets?' + query).status_code, 422)


if __name__ == '__main__':
    unittest.main()
