"""
ExoHabitAI — Admin Model Registry Test Suite
================================================
Validates model version listings, active model retrieval, and details lookup.
"""

import pytest
from tests.conftest import create_admin, get_auth_header
from models.model_version import ModelVersion
from extensions import db


@pytest.fixture
def seed_models(client):
    """Seed test model versions in the database."""
    with client.application.app_context():
        # Clear existing
        ModelVersion.query.delete()
        
        m1 = ModelVersion(
            version="v1.0",
            accuracy=0.89, f1_score=0.90,
            is_active=False, created_by="system"
        )
        m2 = ModelVersion(
            version="v1.1",
            accuracy=0.92, f1_score=0.93,
            is_active=True, created_by="admin"
        )
        db.session.add_all([m1, m2])
        db.session.commit()
        return m1.id, m2.id


def test_models_rbac(client):
    """Model registry endpoints require admin role."""
    headers = get_auth_header(client)
    resp = client.get("/admin/models", headers=headers)
    assert resp.status_code == 403


def test_list_models(client, seed_models):
    """Get /admin/models lists all registered versions sorted desc."""
    headers = create_admin(client)
    resp = client.get("/admin/models", headers=headers)
    assert resp.status_code == 200
    
    data = resp.get_json()["data"]
    models = data["models"]
    assert len(models) == 2
    # Sorted by created_at or id desc
    assert models[0]["version"] == "v1.1"
    assert models[1]["version"] == "v1.0"


def test_get_active_model(client, seed_models):
    """Get /admin/models/active returns the current active model version."""
    headers = create_admin(client)
    resp = client.get("/admin/models/active", headers=headers)
    assert resp.status_code == 200
    
    data = resp.get_json()["data"]
    assert data["model"] is not None
    assert data["model"]["version"] == "v1.1"
    assert data["model"]["is_active"] is True


def test_get_model_detail(client, seed_models):
    """Get /admin/models/<id> returns detail for that version."""
    m1_id, _ = seed_models
    headers = create_admin(client)
    resp = client.get(f"/admin/models/{m1_id}", headers=headers)
    assert resp.status_code == 200
    
    data = resp.get_json()["data"]
    assert data["version"] == "v1.0"
    assert data["f1_score"] == 0.90
