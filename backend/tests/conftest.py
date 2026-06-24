"""
ExoHabitAI — Test Fixtures & Shared Helpers
=============================================
Central pytest configuration providing isolated test infrastructure.

Design decisions:
    - In-memory SQLite DB per test function → no cross-test contamination
    - TestConfig disables rate limiting so tests run without timing issues
    - Fixtures provide pre-built users, tokens, and sample payloads
      so individual test files stay focused on *what* they test

Usage:
    Fixtures are auto-discovered by pytest. Import helpers explicitly:
        from tests.conftest import register_user, login_user, ...
"""

import sys
import os
import pytest

# ---------------------------------------------------------------------------
# PATH SETUP — ensure backend/ is importable regardless of where pytest runs
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app import app as flask_app
from extensions import db as _db
from config import TestConfig


# ===========================================================================
# 1. CORE FIXTURES — app, client, DB session
# ===========================================================================

@pytest.fixture(scope="function")
def app():
    """
    Create a Flask app configured for testing.

    Uses in-memory SQLite so every test starts with a clean database.
    Tables are created before the test and dropped after.

    Also resets module-level shared state (rate limiter, retrain lock/status)
    to prevent cross-test contamination.
    """
    flask_app.config.from_object(TestConfig)

    # --- Reset shared module-level state ---
    # The rate limiter reads Config.RATE_LIMIT_SECONDS directly,
    # and the store dict persists across tests.
    import app as app_module
    app_module._rate_limit_store.clear()

    # Wait for any still-running background retraining thread from a previous
    # test to finish.  Background threads are daemon threads, so they can
    # outlive the test that spawned them.  Without this wait, a thread can
    # write a RetrainingLog row into the *next* test's fresh in-memory DB,
    # making "test_logs_empty_initially" see a non-empty list.
    import time as _time
    _deadline = _time.monotonic() + 10.0  # max 10 s wait
    while app_module._retrain_status["is_running"] and _time.monotonic() < _deadline:
        _time.sleep(0.1)

    # Reset retraining status so each test starts with clean state
    app_module._retrain_status.update({
        "is_running": False,
        "last_started": None,
        "last_completed": None,
        "last_result": None,
    })

    # Release retrain lock if stuck from a previous test
    if app_module._retrain_lock.locked():
        try:
            app_module._retrain_lock.release()
        except RuntimeError:
            pass

    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()



@pytest.fixture(scope="function")
def client(app):
    """Flask test client — sends HTTP requests without a running server."""
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    """Direct DB session for test setup and raw assertions."""
    with app.app_context():
        yield _db.session


# ===========================================================================
# 2. USER FIXTURES — pre-created users for convenience
# ===========================================================================

@pytest.fixture(scope="function")
def normal_user(client):
    """Register a regular user and return (user_dict, auth_headers)."""
    register_user(client, username="researcher", email="researcher@example.com")
    resp = login_user(client, username="researcher")
    data = resp.get_json()["data"]
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return data["user"], headers


@pytest.fixture(scope="function")
def admin_user(client):
    """Create an admin user and return (user_dict, auth_headers)."""
    from auth.services import create_admin_user
    create_admin_user("admin", "admin@example.com", "adminpass123")
    resp = login_user(client, username="admin", password="adminpass123")
    data = resp.get_json()["data"]
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return data["user"], headers


# ===========================================================================
# 3. SAMPLE DATA FIXTURES — realistic planet payloads
# ===========================================================================

@pytest.fixture
def earth_like_payload():
    """
    Earth-like planet — should score relatively HIGH habitability.

    These values approximate Earth's physical properties:
    - Radius ≈ 1 Earth radius
    - Mass ≈ 1 Earth mass
    - Surface temp ≈ 288 K (15°C)
    - G-type star (Sun-like)
    """
    return {
        "planet_name": "Earth-Twin-Test",
        "P_RADIUS": 1.0,
        "P_MASS": 1.0,
        "P_DENSITY": 5.51,
        "P_TEMP_SURF": 288,
        "P_TEMP_EQUIL": 255,
        "P_PERIOD": 365.25,
        "P_SEMI_MAJOR_AXIS": 1.0,
        "P_GRAVITY": 9.8,
        "P_ESCAPE": 11.2,
        "P_ECCENTRICITY": 0.017,
        "P_INCLINATION": 90,
        "P_FLUX": 1.0,
        "S_TEMPERATURE": 5778,
        "S_LUMINOSITY": 1.0,
        "S_MASS": 1.0,
        "S_RADIUS": 1.0,
        "S_DISTANCE": 10,
        "S_METALLICITY": 0.0,
        "S_AGE": 4.6,
        "P_TYPE": "Terran",
        "S_TYPE_TEMP": "G",
    }


@pytest.fixture
def gas_giant_payload():
    """
    Hot Jupiter — should score LOW habitability.

    These values represent an extreme gas giant:
    - 11x Earth radius (Jupiter-like)
    - 318x Earth mass
    - Very hot surface
    - Jovian classification
    """
    return {
        "planet_name": "HotJupiter-Test",
        "P_RADIUS": 11.2,
        "P_MASS": 317.8,
        "P_DENSITY": 1.33,
        "P_TEMP_SURF": 1500,
        "P_TEMP_EQUIL": 1400,
        "P_PERIOD": 3.5,
        "P_SEMI_MAJOR_AXIS": 0.05,
        "P_GRAVITY": 24.79,
        "P_ESCAPE": 59.5,
        "P_ECCENTRICITY": 0.01,
        "P_INCLINATION": 85,
        "P_FLUX": 500.0,
        "S_TEMPERATURE": 6000,
        "S_LUMINOSITY": 1.5,
        "S_MASS": 1.1,
        "S_RADIUS": 1.2,
        "S_DISTANCE": 50,
        "S_METALLICITY": 0.1,
        "S_AGE": 3.0,
        "P_TYPE": "Jovian",
        "S_TYPE_TEMP": "F",
    }


@pytest.fixture
def extreme_hot_payload():
    """
    Extremely hot planet — should score VERY LOW habitability.

    Surface temperature of 5000K makes this uninhabitable by any definition.
    """
    return {
        "planet_name": "Lava-World-Test",
        "P_RADIUS": 1.5,
        "P_MASS": 2.0,
        "P_DENSITY": 6.0,
        "P_TEMP_SURF": 5000,
        "P_TEMP_EQUIL": 4500,
        "P_PERIOD": 0.5,
        "P_SEMI_MAJOR_AXIS": 0.01,
        "P_GRAVITY": 15.0,
        "P_ESCAPE": 15.0,
        "P_ECCENTRICITY": 0.01,
        "P_INCLINATION": 90,
        "P_FLUX": 10000.0,
        "S_TEMPERATURE": 7000,
        "S_LUMINOSITY": 5.0,
        "S_MASS": 1.5,
        "S_RADIUS": 1.5,
        "S_DISTANCE": 20,
        "S_METALLICITY": 0.0,
        "S_AGE": 2.0,
        "P_TYPE": "Superterran",
        "S_TYPE_TEMP": "F",
    }


@pytest.fixture
def minimal_payload():
    """
    Minimal valid payload — only planet_name and one feature.

    Tests that the pipeline handles mostly-missing data gracefully
    (the internal imputer should fill NaN values).
    """
    return {
        "planet_name": "Minimal-Test",
        "P_RADIUS": 1.0,
    }


@pytest.fixture
def invalid_payload_empty():
    """Completely empty payload — should be rejected."""
    return {}


@pytest.fixture
def invalid_payload_negative():
    """Payload with physically impossible values — should be rejected."""
    return {
        "planet_name": "Negative-Mass",
        "P_MASS": -5.0,
    }


# ===========================================================================
# 4. HELPER FUNCTIONS — used by tests directly
# ===========================================================================

def register_user(client, username="testuser", email="test@example.com",
                  password="securepass123"):
    """Register a user via the API and return the response."""
    return client.post("/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })


def login_user(client, username="testuser", password="securepass123"):
    """Login and return the response (contains access_token)."""
    return client.post("/auth/login", json={
        "username": username,
        "password": password,
    })


def get_auth_header(client, username="testuser", password="securepass123"):
    """Register → login → return the Authorization header dict."""
    register_user(client, username=username,
                  email=f"{username}@example.com", password=password)
    resp = login_user(client, username=username, password=password)
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_admin(client):
    """Create an admin via the service layer and return auth headers."""
    from auth.services import create_admin_user
    create_admin_user("admin", "admin@example.com", "adminpass123")
    resp = login_user(client, username="admin", password="adminpass123")
    token = resp.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def approve_all_planets():
    """
    Mark every stored planet as APPROVED.

    User-submitted planets are PENDING by default and hidden from public
    rankings. Tests that exercise /rank content seed planets and then call
    this helper to make them visible — mirroring an admin approval.
    """
    from extensions import db
    from models.exoplanet import Exoplanet, PlanetStatus
    Exoplanet.query.update(
        {Exoplanet.status: PlanetStatus.APPROVED}, synchronize_session=False
    )
    db.session.commit()
