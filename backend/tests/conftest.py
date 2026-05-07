"""
ExoHabitAI — Test Fixtures
============================
Shared pytest fixtures for all test modules.

Uses an in-memory SQLite database for speed and isolation.
Each test function gets a fresh database via the `client` fixture.
"""

import sys
import os
import pytest

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app
from extensions import db as _db
from config import TestConfig


@pytest.fixture(scope="function")
def app():
    """Create a Flask app configured for testing."""
    flask_app.config.from_object(TestConfig)
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """Flask test client — sends requests without running a real server."""
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    """Direct DB session access for test setup/assertions."""
    with app.app_context():
        yield _db.session


def register_user(client, username="testuser", email="test@example.com",
                  password="securepass123"):
    """Helper — register a user and return the response."""
    return client.post("/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })


def login_user(client, username="testuser", password="securepass123"):
    """Helper — login and return the response."""
    return client.post("/auth/login", json={
        "username": username,
        "password": password,
    })


def get_auth_header(client, username="testuser", password="securepass123"):
    """Helper — register, login, and return the Authorization header."""
    register_user(client, username=username,
                  email=f"{username}@example.com", password=password)
    resp = login_user(client, username=username, password=password)
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_admin(client):
    """Helper — create an admin via the service layer and return auth header."""
    from auth.services import create_admin_user
    create_admin_user("admin", "admin@example.com", "adminpass123")
    resp = login_user(client, username="admin", password="adminpass123")
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
