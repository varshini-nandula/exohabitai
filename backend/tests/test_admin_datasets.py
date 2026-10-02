"""
ExoHabitAI — Admin Dataset Management Test Suite
===================================================
Validates training dataset CSV upload, duplicate check, validation runs,
marking as ready for retraining, and deletions.
"""

import io
import os
import pytest
from tests.conftest import create_admin, get_auth_header
from models.training_dataset import TrainingDataset, DatasetStatus
from extensions import db


@pytest.fixture
def clean_datasets(client):
    """Clean database and filesystem datasets after/before tests."""
    yield
    with client.application.app_context():
        datasets = TrainingDataset.query.all()
        for d in datasets:
            if os.path.exists(d.storage_path):
                try:
                    os.remove(d.storage_path)
                except OSError:
                    pass
        TrainingDataset.query.delete()
        db.session.commit()


def test_datasets_rbac(client):
    """Dataset endpoints must require admin role."""
    headers = get_auth_header(client)
    resp = client.get("/admin/datasets", headers=headers)
    assert resp.status_code == 403


def test_upload_dataset_success(client, clean_datasets):
    """Admins can upload a valid training dataset CSV."""
    headers = create_admin(client)
    csv_data = "P_HABITABLE_BINARY,P_RADIUS,P_MASS\n0,1.0,1.0\n1,2.0,5.0\n"
    
    data = {
        "file": (io.BytesIO(csv_data.encode("utf-8")), "new_data.csv"),
        "name": "June Retrain Data",
        "notes": "100 confirmed planets"
    }

    resp = client.post(
        "/admin/datasets/upload",
        data=data,
        content_type="multipart/form-data",
        headers=headers
    )
    assert resp.status_code == 201
    
    resp_data = resp.get_json()["data"]
    assert resp_data["name"] == "June Retrain Data"
    assert resp_data["status"] == DatasetStatus.UPLOADED

    # Verify stored in DB
    with client.application.app_context():
        record = TrainingDataset.query.filter_by(name="June Retrain Data").first()
        assert record is not None
        assert record.row_count == 2
        assert record.column_count == 3
        assert os.path.exists(record.storage_path)


def test_upload_duplicate_dataset(client, clean_datasets):
    """Uploading the same dataset twice triggers a 409 duplicate error."""
    headers = create_admin(client)
    csv_data = "P_HABITABLE_BINARY,P_RADIUS,P_MASS\n0,1.0,1.0\n"

    # First upload
    resp1 = client.post(
        "/admin/datasets/upload",
        data={"file": (io.BytesIO(csv_data.encode("utf-8")), "data.csv"), "name": "D1"},
        content_type="multipart/form-data",
        headers=headers
    )
    assert resp1.status_code == 201

    # Second upload (same content)
    resp2 = client.post(
        "/admin/datasets/upload",
        data={"file": (io.BytesIO(csv_data.encode("utf-8")), "data2.csv"), "name": "D2"},
        content_type="multipart/form-data",
        headers=headers
    )
    assert resp2.status_code == 409
    assert "duplicate" in resp2.get_json()["message"].lower()


def test_dataset_validate_and_ready_lifecycle(client, clean_datasets):
    """Admins can validate a dataset and then mark it ready for retraining."""
    headers = create_admin(client)
    csv_data = "P_HABITABLE_BINARY,P_RADIUS,P_MASS\n0,1.0,1.0\n1,1.2,2.0\n"

    # 1. Upload
    resp_upload = client.post(
        "/admin/datasets/upload",
        data={"file": (io.BytesIO(csv_data.encode("utf-8")), "to_validate.csv"), "name": "Lifecycle"},
        content_type="multipart/form-data",
        headers=headers
    )
    assert resp_upload.status_code == 201
    dataset_id = resp_upload.get_json()["data"]["id"]

    # 2. Try marking ready before validation -> should fail
    resp_ready_fail = client.post(f"/admin/datasets/{dataset_id}/ready", headers=headers)
    assert resp_ready_fail.status_code == 400

    # 3. Validate dataset
    resp_validate = client.post(f"/admin/datasets/{dataset_id}/validate", headers=headers)
    assert resp_validate.status_code == 200
    assert resp_validate.get_json()["data"]["validation"]["valid"] is True
    
    with client.application.app_context():
        record = db.session.get(TrainingDataset, dataset_id)
        assert record.status == DatasetStatus.VALIDATED

    # 4. Mark ready -> should succeed
    resp_ready_success = client.post(f"/admin/datasets/{dataset_id}/ready", headers=headers)
    assert resp_ready_success.status_code == 200
    
    with client.application.app_context():
        record = db.session.get(TrainingDataset, dataset_id)
        assert record.status == DatasetStatus.READY


def test_delete_dataset(client, clean_datasets):
    """Admins can delete a dataset which cleans up the DB record and the disk file."""
    headers = create_admin(client)
    csv_data = "P_HABITABLE_BINARY,P_RADIUS\n0,1.0\n"

    # Upload
    resp_upload = client.post(
        "/admin/datasets/upload",
        data={"file": (io.BytesIO(csv_data.encode("utf-8")), "to_delete.csv"), "name": "Deletable"},
        content_type="multipart/form-data",
        headers=headers
    )
    dataset_id = resp_upload.get_json()["data"]["id"]
    
    with client.application.app_context():
        record = db.session.get(TrainingDataset, dataset_id)
        file_path = record.storage_path
        assert os.path.exists(file_path)

    # Delete
    resp_delete = client.delete(f"/admin/datasets/{dataset_id}", headers=headers)
    assert resp_delete.status_code == 200

    # Verify DB & File gone
    with client.application.app_context():
        assert db.session.get(TrainingDataset, dataset_id) is None
        assert not os.path.exists(file_path)
