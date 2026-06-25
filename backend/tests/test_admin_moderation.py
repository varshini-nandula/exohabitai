"""
ExoHabitAI — Admin Moderation Test Suite
===========================================
Validates the planet moderation flow: listing pending/all planets,
retrieving detail, and approving or rejecting submissions.
Verifies that approved planets appear in public rankings, while
pending/rejected ones do not.
"""

import pytest
from tests.conftest import create_admin, get_auth_header
from models.exoplanet import Exoplanet, PlanetStatus
from extensions import db


@pytest.fixture
def test_planets(client):
    """Seed three planets with different statuses."""
    # We use admin auth or direct DB entry
    with client.application.app_context():
        # Get a user id or create user first
        from auth.services import register_user
        user, _ = register_user("submitter", "sub@sub.com", "pass1234")
        
        p1 = Exoplanet(
            planet_name="Kepler-Pending",
            status=PlanetStatus.PENDING,
            created_by_user_id=user.id,
            P_RADIUS=1.0, P_MASS=1.0,
            habitability_probability=0.85, habitability=1,
            is_user_generated=True
        )
        p2 = Exoplanet(
            planet_name="Kepler-Approved",
            status=PlanetStatus.APPROVED,
            created_by_user_id=user.id,
            P_RADIUS=1.2, P_MASS=1.5,
            habitability_probability=0.91, habitability=1,
            is_user_generated=True
        )
        p3 = Exoplanet(
            planet_name="Kepler-Rejected",
            status=PlanetStatus.REJECTED,
            created_by_user_id=user.id,
            P_RADIUS=15.0, P_MASS=300.0,
            habitability_probability=0.02, habitability=0,
            is_user_generated=True
        )
        db.session.add_all([p1, p2, p3])
        db.session.commit()
        return p1.id, p2.id, p3.id


def test_moderation_rbac(client):
    """Moderation endpoints must require admin role."""
    headers = get_auth_header(client)
    # Pending
    resp = client.get("/admin/planets/pending", headers=headers)
    assert resp.status_code == 403
    # Approve
    resp = client.post("/admin/planets/1/approve", headers=headers)
    assert resp.status_code == 403


def test_list_pending_planets(client, test_planets):
    """Get /admin/planets/pending should only list pending submissions."""
    headers = create_admin(client)
    resp = client.get("/admin/planets/pending", headers=headers)
    assert resp.status_code == 200

    data = resp.get_json()["data"]
    planets = data["planets"]
    assert len(planets) == 1
    assert planets[0]["planet_name"] == "Kepler-Pending"
    assert planets[0]["status"] == PlanetStatus.PENDING


def test_list_all_planets_filtered(client, test_planets):
    """Get /admin/planets/all should support status filters."""
    headers = create_admin(client)
    
    # Filter by approved
    resp = client.get("/admin/planets/all?status=approved", headers=headers)
    assert resp.status_code == 200
    planets = resp.get_json()["data"]["planets"]
    assert len(planets) == 1
    assert planets[0]["planet_name"] == "Kepler-Approved"

    # Filter by search query
    resp = client.get("/admin/planets/all?search=Rejected", headers=headers)
    assert resp.status_code == 200
    planets = resp.get_json()["data"]["planets"]
    assert len(planets) == 1
    assert planets[0]["planet_name"] == "Kepler-Rejected"


def test_planet_detail(client, test_planets):
    """Get /admin/planets/<id> should return full detail including submitter."""
    p1_id, _, _ = test_planets
    headers = create_admin(client)
    resp = client.get(f"/admin/planets/{p1_id}", headers=headers)
    assert resp.status_code == 200

    data = resp.get_json()["data"]
    assert data["planet_name"] == "Kepler-Pending"
    assert "features" in data
    assert "submitter" in data
    assert data["submitter"]["username"] == "submitter"


def test_approve_planet(client, test_planets):
    """Approving a planet updates status and makes it visible in public rankings."""
    p1_id, _, _ = test_planets
    headers = create_admin(client)

    # First verify Kepler-Pending is NOT in public rankings
    resp = client.get("/rank")
    assert resp.status_code == 200
    public_planets = resp.get_json()["data"]["planets"]
    assert not any(p["planet_name"] == "Kepler-Pending" for p in public_planets)

    # Approve the planet
    resp = client.post(f"/admin/planets/{p1_id}/approve", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "success"

    # Verify status changed in DB
    with client.application.app_context():
        p = db.session.get(Exoplanet, p1_id)
        assert p.status == PlanetStatus.APPROVED

    # Now verify Kepler-Pending IS in public rankings
    resp = client.get("/rank")
    assert resp.status_code == 200
    public_planets = resp.get_json()["data"]["planets"]
    assert any(p["planet_name"] == "Kepler-Pending" for p in public_planets)


def test_reject_planet(client, test_planets):
    """Rejecting a planet updates status and keeps it hidden from public rankings."""
    p1_id, p2_id, _ = test_planets
    headers = create_admin(client)

    # Reject
    resp = client.post(f"/admin/planets/{p1_id}/reject", headers=headers)
    assert resp.status_code == 200

    # Verify status changed in DB
    with client.application.app_context():
        p = db.session.get(Exoplanet, p1_id)
        assert p.status == PlanetStatus.REJECTED

    # Verify it is not in public rankings
    resp = client.get("/rank")
    assert resp.status_code == 200
    public_planets = resp.get_json()["data"]["planets"]
    assert not any(p["planet_name"] == "Kepler-Pending" for p in public_planets)
