"""
ExoHabitAI — Admin Retraining Test Suite
===========================================
Validates that model retraining can be triggered, concurrency is locked,
status is queryable, and retrain logs are correctly audited.
"""

import time
import pytest
from tests.conftest import create_admin, get_auth_header
from models.training_dataset import TrainingDataset, DatasetStatus
from models.retraining_log import RetrainingLog
from extensions import db


@pytest.fixture
def seed_ready_dataset(client):
    """Seed a dataset marked as READY."""
    with client.application.app_context():
        import tempfile
        import os
        
        fd, path = tempfile.mkstemp(suffix=".csv")
        os.write(fd, b"P_HABITABLE_BINARY,P_RADIUS\n0,1.0\n1,1.2\n")
        os.close(fd)
        
        d = TrainingDataset(
            name="Ready Dataset",
            filename="ready.csv",
            storage_path=path,
            uploaded_by="admin",
            status=DatasetStatus.READY,
            file_hash="dummyhash123",
            row_count=2,
            column_count=2
        )
        db.session.add(d)
        db.session.commit()
        
        yield d.id
        
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


def test_retraining_rbac(client):
    """Retraining routes must require admin role."""
    headers = get_auth_header(client)
    resp = client.post("/admin/retraining/start", headers=headers)
    assert resp.status_code == 403


def test_retrain_not_ready_dataset(client):
    """Retraining fails if the specified dataset is not ready."""
    headers = create_admin(client)
    
    # Seed an uploaded but not ready dataset
    with client.application.app_context():
        d = TrainingDataset(
            name="Not Ready", filename="notready.csv",
            storage_path="/tmp/notready.csv", uploaded_by="admin",
            status=DatasetStatus.UPLOADED
        )
        db.session.add(d)
        db.session.commit()
        d_id = d.id

    resp = client.post(
        "/admin/retraining/start",
        json={"dataset_id": d_id, "reason": "Test non-ready"},
        headers=headers
    )
    assert resp.status_code == 400
    assert "not ready" in resp.get_json()["message"].lower()


def test_retrain_start_baseline_success(client):
    """Retraining starts in background (returns 202) for a baseline retrain (no dataset_id)."""
    headers = create_admin(client)
    resp = client.post(
        "/admin/retraining/start",
        json={"reason": "Baseline retrain test"},
        headers=headers
    )
    assert resp.status_code == 202
    assert resp.get_json()["status"] == "accepted"
    
    # Wait briefly for thread to start/finish or check status
    resp_status = client.get("/admin/retraining/status", headers=headers)
    assert resp_status.status_code == 200
    # Clean up lock/status if running to prevent cross-test contamination
    import app as app_module
    app_module._retrain_status["is_running"] = False


def test_retrain_start_with_dataset_success(client, seed_ready_dataset):
    """Retraining starts in background (returns 202) when using a ready dataset."""
    headers = create_admin(client)
    resp = client.post(
        "/admin/retraining/start",
        json={"dataset_id": seed_ready_dataset, "reason": "Ready dataset retrain test"},
        headers=headers
    )
    assert resp.status_code == 202
    assert resp.get_json()["status"] == "accepted"
    
    # Clean up lock/status if running to prevent cross-test contamination
    import app as app_module
    app_module._retrain_status["is_running"] = False


def test_concurrency_lock(client):
    """Concurrency lock prevents running multiple retraining runs at once."""
    headers = create_admin(client)
    
    import app as app_module
    app_module._retrain_status["is_running"] = True
    app_module._retrain_lock.acquire(blocking=False)

    resp = client.post(
        "/admin/retraining/start",
        json={"reason": "Concurrent attempt"},
        headers=headers
    )
    assert resp.status_code == 409
    assert "already in progress" in resp.get_json()["message"].lower()

    # Release lock & status
    app_module._retrain_status["is_running"] = False
    app_module._retrain_lock.release()


def test_retraining_logs(client):
    """Logs endpoint should return list of retraining run audit trails."""
    headers = create_admin(client)
    
    with client.application.app_context():
        log = RetrainingLog(
            status="success",
            model_version="v1.1",
            previous_model_version="v1.0",
            dataset_version="hash123",
            dataset_size=100,
            user_data_count=0,
            accuracy=0.95,
            f1_score=0.94,
            reason="Test log",
            requested_by="admin"
        )
        db.session.add(log)
        db.session.commit()

    resp = client.get("/admin/retraining/logs", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert len(data["logs"]) >= 1
    assert data["logs"][0]["reason"] == "Test log"
