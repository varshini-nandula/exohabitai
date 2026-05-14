"""
ExoHabitAI — Database Integrity Test Suite
============================================
Validates data models, constraints, ownership tracking, and serialization.

WHY THESE TESTS MATTER:
    The database is the system of record. If constraints are missing,
    timestamps don't populate, or foreign keys are broken, data
    integrity issues will accumulate silently and corrupt rankings,
    audit trails, and retraining datasets.

WHAT FAILURES WOULD INDICATE:
    - Uniqueness failures → duplicate planets/users in DB
    - Foreign key failures → orphaned records
    - Timestamp failures → audit trail is unreliable
    - Serialization failures → raw_input_json is lost or corrupt
"""

import json
import pytest
from datetime import datetime, timezone


class TestUserModel:
    """Validate User model constraints and behavior."""

    def test_user_creation(self, client, db_session):
        """Users are created with correct defaults."""
        from models.user import User, UserRole
        user = User(username="dbtest", email="db@test.com", role=UserRole.USER)
        user.set_password("testpass123")
        db_session.add(user)
        db_session.commit()

        fetched = User.query.filter_by(username="dbtest").first()
        assert fetched is not None
        assert fetched.role == "user"
        assert fetched.is_active is True
        assert fetched.created_at is not None

    def test_username_uniqueness(self, client, db_session):
        """Duplicate usernames must raise an integrity error."""
        from models.user import User
        u1 = User(username="unique", email="a@test.com")
        u1.set_password("testpass123")
        db_session.add(u1)
        db_session.commit()

        u2 = User(username="unique", email="b@test.com")
        u2.set_password("testpass123")
        db_session.add(u2)
        with pytest.raises(Exception):
            db_session.commit()
        db_session.rollback()

    def test_email_uniqueness(self, client, db_session):
        """Duplicate emails must raise an integrity error."""
        from models.user import User
        u1 = User(username="user1", email="same@test.com")
        u1.set_password("testpass123")
        db_session.add(u1)
        db_session.commit()

        u2 = User(username="user2", email="same@test.com")
        u2.set_password("testpass123")
        db_session.add(u2)
        with pytest.raises(Exception):
            db_session.commit()
        db_session.rollback()

    def test_is_admin_property(self, client, db_session):
        """is_admin property should reflect role correctly."""
        from models.user import User, UserRole
        admin = User(username="adm", email="adm@test.com", role=UserRole.ADMIN)
        admin.set_password("testpass123")
        regular = User(username="reg", email="reg@test.com", role=UserRole.USER)
        regular.set_password("testpass123")

        assert admin.is_admin is True
        assert regular.is_admin is False

    def test_user_repr(self, client, db_session):
        """__repr__ should return a readable string."""
        from models.user import User
        user = User(username="repr_test", email="repr@test.com")
        assert "repr_test" in repr(user)


class TestExoplanetModel:
    """Validate Exoplanet model constraints and features."""

    def test_planet_creation(self, client, db_session):
        """Planets are created with correct fields."""
        from models.exoplanet import Exoplanet
        planet = Exoplanet(
            planet_name="Test-Planet-1",
            P_RADIUS=1.0, P_MASS=1.0,
            habitability_probability=0.75,
            habitability=1,
            is_user_generated=True,
        )
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="Test-Planet-1").first()
        assert fetched is not None
        assert fetched.P_RADIUS == 1.0
        assert fetched.habitability_probability == 0.75
        assert fetched.is_user_generated is True

    def test_planet_name_uniqueness(self, client, db_session):
        """Duplicate planet names must raise an integrity error."""
        from models.exoplanet import Exoplanet
        p1 = Exoplanet(planet_name="Unique-Planet")
        db_session.add(p1)
        db_session.commit()

        p2 = Exoplanet(planet_name="Unique-Planet")
        db_session.add(p2)
        with pytest.raises(Exception):
            db_session.commit()
        db_session.rollback()

    def test_stored_features_list(self, client):
        """STORED_FEATURES must match the expected baseline features."""
        from models.exoplanet import Exoplanet
        expected = {"P_RADIUS", "P_MASS", "P_DENSITY", "P_TEMP_SURF",
                     "P_PERIOD", "P_SEMI_MAJOR_AXIS",
                     "S_TEMPERATURE", "S_LUMINOSITY", "S_METALLICITY"}
        assert set(Exoplanet.STORED_FEATURES) == expected

    def test_nullable_features(self, client, db_session):
        """Physical features should be nullable (not all planets have all data)."""
        from models.exoplanet import Exoplanet
        planet = Exoplanet(planet_name="Sparse-Planet")
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="Sparse-Planet").first()
        assert fetched.P_RADIUS is None
        assert fetched.P_MASS is None

    def test_raw_input_json_storage(self, client, db_session):
        """raw_input_json should store and retrieve valid JSON."""
        from models.exoplanet import Exoplanet
        raw = {"P_RADIUS": 1.0, "S_TEMPERATURE": 5778, "extra": "data"}
        planet = Exoplanet(
            planet_name="JSON-Test",
            raw_input_json=json.dumps(raw),
        )
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="JSON-Test").first()
        recovered = json.loads(fetched.raw_input_json)
        assert recovered["P_RADIUS"] == 1.0
        assert recovered["extra"] == "data"


class TestOwnershipTracking:
    """Validate user-planet ownership via foreign keys."""

    def test_created_by_user_id_stored(self, client, db_session):
        """Planets should track which user created them."""
        from models.user import User
        from models.exoplanet import Exoplanet

        user = User(username="owner", email="owner@test.com")
        user.set_password("testpass123")
        db_session.add(user)
        db_session.commit()

        planet = Exoplanet(
            planet_name="Owned-Planet",
            created_by_user_id=user.id,
            is_user_generated=True,
        )
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="Owned-Planet").first()
        assert fetched.created_by_user_id == user.id

    def test_seeded_planets_have_no_owner(self, client, db_session):
        """Dataset-seeded planets should have no user owner."""
        from models.exoplanet import Exoplanet
        planet = Exoplanet(
            planet_name="Seeded-Planet",
            is_user_generated=False,
        )
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="Seeded-Planet").first()
        assert fetched.created_by_user_id is None
        assert fetched.is_user_generated is False


class TestTimestamps:
    """Validate automatic timestamp behavior."""

    def test_created_at_auto_populated(self, client, db_session):
        """created_at should be set automatically on insert."""
        from models.exoplanet import Exoplanet
        planet = Exoplanet(planet_name="Timestamp-Test")
        db_session.add(planet)
        db_session.commit()

        fetched = Exoplanet.query.filter_by(planet_name="Timestamp-Test").first()
        assert fetched.created_at is not None

    def test_user_created_at_auto_populated(self, client, db_session):
        """User created_at should be set automatically."""
        from models.user import User
        user = User(username="ts_user", email="ts@test.com")
        user.set_password("testpass123")
        db_session.add(user)
        db_session.commit()

        fetched = User.query.filter_by(username="ts_user").first()
        assert fetched.created_at is not None


class TestRetrainingLogModel:
    """Validate RetrainingLog model."""

    def test_log_creation(self, client, db_session):
        """Retraining logs should store all audit fields."""
        from models.retraining_log import RetrainingLog
        log = RetrainingLog(
            status="success",
            model_version="v2_pipeline_test123",
            previous_model_version="v2_pipeline_old456",
            dataset_version="abc123",
            dataset_size=5000,
            user_data_count=10,
            accuracy=0.95,
            f1_score=0.88,
            roc_auc=0.92,
            reason="unit test",
            requested_by="test_admin",
            details=json.dumps({"test": True}),
        )
        db_session.add(log)
        db_session.commit()

        fetched = RetrainingLog.query.first()
        assert fetched.status == "success"
        assert fetched.f1_score == 0.88
        assert fetched.reason == "unit test"
        assert fetched.timestamp is not None

    def test_log_details_json(self, client, db_session):
        """details field should store and retrieve JSON."""
        from models.retraining_log import RetrainingLog
        details = {"accuracy": 0.95, "notes": "test run"}
        log = RetrainingLog(
            status="success",
            details=json.dumps(details),
        )
        db_session.add(log)
        db_session.commit()

        fetched = RetrainingLog.query.first()
        recovered = json.loads(fetched.details)
        assert recovered["accuracy"] == 0.95


class TestModelVersionTracking:
    """Validate model version is stored with predictions."""

    def test_prediction_stores_model_version(self, client, earth_like_payload):
        """Stored predictions should include the current model version."""
        from models.exoplanet import Exoplanet
        client.post("/predict_and_store_batch", json=[earth_like_payload])

        planet = Exoplanet.query.filter_by(planet_name="Earth-Twin-Test").first()
        assert planet is not None
        assert planet.model_version is not None
        assert planet.model_version.startswith("v2_pipeline_")
