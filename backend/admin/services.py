"""
ExoHabitAI — Admin Services (Business Logic)
===============================================
Shared business logic for admin endpoints.

Follows the same pattern as auth/services.py — routes handle HTTP
concerns, services handle database queries and business rules.
"""

import logging
from datetime import datetime, timezone

from extensions import db
from models.user import User, UserRole
from models.exoplanet import Exoplanet, PlanetStatus
from models.retraining_log import RetrainingLog
from models.training_dataset import TrainingDataset, DatasetStatus
from models.model_version import ModelVersion

logger = logging.getLogger("exohabitai.admin")


# ==========================================================================
# Dashboard
# ==========================================================================

def get_dashboard_stats() -> dict:
    """
    Aggregate all dashboard statistics in a single service call.

    Returns system status, counts, current model info, last retrain,
    and recent submissions.
    """
    # --- System status (reuse health check logic) ---
    db_ok = True
    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception:
        db_ok = False

    # --- Counts ---
    total_users = User.query.count()
    total_planets = Exoplanet.query.count()
    pending = Exoplanet.query.filter_by(status=PlanetStatus.PENDING).count()
    approved = Exoplanet.query.filter_by(status=PlanetStatus.APPROVED).count()
    rejected = Exoplanet.query.filter_by(status=PlanetStatus.REJECTED).count()
    user_generated = Exoplanet.query.filter_by(is_user_generated=True).count()
    with_prediction = Exoplanet.query.filter(
        Exoplanet.habitability_probability.isnot(None)
    ).count()

    # --- Current active model ---
    active_model = ModelVersion.query.filter_by(is_active=True).first()
    current_model = None
    if active_model:
        current_model = active_model.to_dict()

    # --- Last retraining ---
    last_retrain = (
        RetrainingLog.query
        .order_by(RetrainingLog.timestamp.desc())
        .first()
    )
    last_retraining = None
    if last_retrain:
        last_retraining = {
            "id": last_retrain.id,
            "timestamp": last_retrain.timestamp.isoformat() if last_retrain.timestamp else None,
            "status": last_retrain.status,
            "model_version": last_retrain.model_version,
            "requested_by": last_retrain.requested_by,
        }

    # --- Recent submissions (last 10) ---
    recent = (
        Exoplanet.query
        .filter_by(is_user_generated=True)
        .order_by(Exoplanet.created_at.desc())
        .limit(10)
        .all()
    )
    recent_submissions = []
    for p in recent:
        submitter = None
        if p.created_by_user_id:
            user = User.query.get(p.created_by_user_id)
            if user:
                submitter = user.username
        recent_submissions.append({
            "id": p.id,
            "planet_name": p.planet_name,
            "submitter": submitter,
            "habitability_probability": (
                round(p.habitability_probability, 6)
                if p.habitability_probability is not None else None
            ),
            "habitability": p.habitability,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    import app as app_module
    model_version = getattr(app_module, "MODEL_VERSION", "v1.0")
    retraining_in_progress = app_module._retrain_status.get("is_running", False)

    return {
        "system_status": {
            "backend_online": True,
            "db_connected": db_ok,
            "model_loaded": True,
            "model_version": model_version,
            "retraining_in_progress": retraining_in_progress,
        },
        "stats": {
            "total_users": total_users,
            "total_planets": total_planets,
            "pending_submissions": pending,
            "approved_planets": approved,
            "rejected_planets": rejected,
            "user_generated": user_generated,
            "with_prediction": with_prediction,
        },
        "current_model": current_model,
        "last_retraining": last_retraining,
        "recent_submissions": recent_submissions,
    }


# ==========================================================================
# Moderation
# ==========================================================================

def get_planets_by_status(status=None, search=None, page=1, per_page=20):
    """
    Query planets with optional status filter, search, and pagination.

    Returns (items_list, total_count, page, per_page).
    """
    query = Exoplanet.query

    if status and PlanetStatus.is_valid(status):
        query = query.filter_by(status=status)

    if search:
        search_term = f"%{search}%"
        query = query.filter(Exoplanet.planet_name.ilike(search_term))

    query = query.order_by(Exoplanet.created_at.desc())
    total = query.count()

    items = query.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for p in items:
        submitter = None
        if p.created_by_user_id:
            user = User.query.get(p.created_by_user_id)
            if user:
                submitter = user.username
        results.append({
            "id": p.id,
            "planet_name": p.planet_name,
            "submitter": submitter,
            "submitter_id": p.created_by_user_id,
            "habitability_probability": (
                round(p.habitability_probability, 6)
                if p.habitability_probability is not None else None
            ),
            "habitability": p.habitability,
            "status": p.status,
            "is_user_generated": p.is_user_generated,
            "model_version": p.model_version,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return results, total, page, per_page


def get_planet_detail(planet_id: int) -> dict | None:
    """
    Get full planet detail including features, raw input, and submitter info.
    """
    import json

    planet = Exoplanet.query.get(planet_id)
    if not planet:
        return None

    # Submitter info
    submitter = None
    if planet.created_by_user_id:
        user = User.query.get(planet.created_by_user_id)
        if user:
            submitter = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
            }

    # Physical features
    features = {}
    for feat in Exoplanet.STORED_FEATURES:
        features[feat] = getattr(planet, feat, None)

    # Raw input JSON
    raw_input = None
    if planet.raw_input_json:
        try:
            raw_input = json.loads(planet.raw_input_json)
        except (json.JSONDecodeError, TypeError):
            raw_input = planet.raw_input_json

    return {
        "id": planet.id,
        "planet_name": planet.planet_name,
        "features": features,
        "habitability_probability": (
            round(planet.habitability_probability, 6)
            if planet.habitability_probability is not None else None
        ),
        "habitability": planet.habitability,
        "model_version": planet.model_version,
        "status": planet.status,
        "is_user_generated": planet.is_user_generated,
        "raw_input": raw_input,
        "submitter": submitter,
        "created_at": planet.created_at.isoformat() if planet.created_at else None,
        "updated_at": planet.updated_at.isoformat() if planet.updated_at else None,
    }


def moderate_planet(planet_id: int, new_status: str) -> tuple[dict | None, str]:
    """
    Change a planet's moderation status.

    Returns (planet_dict, message) on success, (None, error_msg) on failure.
    """
    planet = Exoplanet.query.get(planet_id)
    if not planet:
        return None, f"Planet with id {planet_id} not found"

    if not PlanetStatus.is_valid(new_status):
        return None, f"Invalid status: {new_status}"

    old_status = planet.status
    planet.status = new_status

    try:
        db.session.commit()
        logger.info(
            "Planet moderated: id=%d, name=%s, %s → %s",
            planet.id, planet.planet_name, old_status, new_status,
        )
        return {
            "id": planet.id,
            "planet_name": planet.planet_name,
            "status": planet.status,
            "previous_status": old_status,
        }, f"Planet '{planet.planet_name}' {new_status}"
    except Exception as exc:
        db.session.rollback()
        logger.error("Moderation DB error: %s", exc)
        return None, f"Database error: {exc}"


# ==========================================================================
# User Management
# ==========================================================================

def get_users(search=None, role=None, is_active=None, page=1, per_page=20):
    """
    Query users with optional filters and pagination.
    """
    query = User.query

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    if role and UserRole.is_valid(role):
        query = query.filter_by(role=role)

    if is_active is not None:
        query = query.filter_by(is_active=is_active)

    query = query.order_by(User.created_at.desc())
    total = query.count()

    items = query.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for u in items:
        submission_count = Exoplanet.query.filter_by(
            created_by_user_id=u.id
        ).count()
        user_dict = u.to_dict()
        user_dict["submission_count"] = submission_count
        results.append(user_dict)

    return results, total, page, per_page


def get_user_detail(user_id: int) -> dict | None:
    """Get user detail with submission statistics."""
    user = User.query.get(user_id)
    if not user:
        return None

    submission_count = Exoplanet.query.filter_by(
        created_by_user_id=user.id
    ).count()
    approved_count = Exoplanet.query.filter_by(
        created_by_user_id=user.id, status=PlanetStatus.APPROVED
    ).count()
    pending_count = Exoplanet.query.filter_by(
        created_by_user_id=user.id, status=PlanetStatus.PENDING
    ).count()
    rejected_count = Exoplanet.query.filter_by(
        created_by_user_id=user.id, status=PlanetStatus.REJECTED
    ).count()

    user_dict = user.to_dict()
    user_dict["submission_count"] = submission_count
    user_dict["approved_count"] = approved_count
    user_dict["pending_count"] = pending_count
    user_dict["rejected_count"] = rejected_count

    return user_dict


def update_user_status(user_id: int, active: bool, admin_user_id: int) -> tuple[dict | None, str]:
    """Activate or deactivate a user account."""
    user = User.query.get(user_id)
    if not user:
        return None, f"User with id {user_id} not found"

    if user.id == admin_user_id:
        return None, "Cannot modify your own account status"

    user.is_active = active
    try:
        db.session.commit()
        action = "activated" if active else "deactivated"
        logger.info("User %s: id=%d, username=%s", action, user.id, user.username)
        return user.to_dict(), f"User '{user.username}' {action}"
    except Exception as exc:
        db.session.rollback()
        return None, f"Database error: {exc}"


def update_user_role(user_id: int, new_role: str, admin_user_id: int) -> tuple[dict | None, str]:
    """Promote or demote a user."""
    user = User.query.get(user_id)
    if not user:
        return None, f"User with id {user_id} not found"

    if not UserRole.is_valid(new_role):
        return None, f"Invalid role: {new_role}"

    if user.id == admin_user_id:
        return None, "Cannot modify your own role"

    # Prevent removing the last admin
    if user.role == UserRole.ADMIN and new_role == UserRole.USER:
        admin_count = User.query.filter_by(role=UserRole.ADMIN, is_active=True).count()
        if admin_count <= 1:
            return None, "Cannot demote the last admin. Promote another user first."

    old_role = user.role
    user.role = new_role

    try:
        db.session.commit()
        logger.info(
            "User role changed: id=%d, username=%s, %s → %s",
            user.id, user.username, old_role, new_role,
        )
        return user.to_dict(), f"User '{user.username}' role changed to {new_role}"
    except Exception as exc:
        db.session.rollback()
        return None, f"Database error: {exc}"


# ==========================================================================
# Model Registry
# ==========================================================================

def get_next_model_version() -> str:
    """
    Compute the next semantic version string.

    If no versions exist, returns "v1.0".
    Otherwise increments the minor version of the latest entry.
    """
    latest = (
        ModelVersion.query
        .order_by(ModelVersion.id.desc())
        .first()
    )
    if not latest:
        return "v1.0"

    try:
        version_str = latest.version.lstrip("v")
        parts = version_str.split(".")
        major = int(parts[0])
        minor = int(parts[1]) if len(parts) > 1 else 0
        return f"v{major}.{minor + 1}"
    except (ValueError, IndexError):
        # Fallback if version string is malformed
        return f"v1.{latest.id}"


def seed_initial_model_version(model_version_hash: str, artifact_path: str):
    """
    Seed v1.0 model version from the currently loaded pipeline.

    Called once on startup if the model_versions table is empty.
    This bootstraps the registry without requiring a retrain.
    """
    if ModelVersion.query.count() > 0:
        return  # Already seeded

    version = ModelVersion(
        version="v1.0",
        artifact_path=artifact_path,
        dataset_version=model_version_hash,
        is_active=True,
        created_by="system",
        notes="Initial model — seeded from existing pipeline on first startup",
    )
    db.session.add(version)
    try:
        db.session.commit()
        logger.info("Seeded initial model version: v1.0")
    except Exception as exc:
        db.session.rollback()
        logger.error("Failed to seed initial model version: %s", exc)
