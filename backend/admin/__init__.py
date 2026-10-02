"""
ExoHabitAI — Admin Module
===========================
Blueprint registration and module exports for the admin control plane.

All admin endpoints share the /admin URL prefix and require the
@admin_required() decorator (JWT + role=admin).

Mirrors the auth/ module pattern to keep app.py focused on
prediction and public API endpoints.
"""

from admin.routes_dashboard import admin_bp

# Import all route modules to register their endpoints with the blueprint
import admin.routes_moderation    # noqa: F401
import admin.routes_users         # noqa: F401
import admin.routes_datasets      # noqa: F401
import admin.routes_models        # noqa: F401
import admin.routes_retraining    # noqa: F401

__all__ = ["admin_bp"]
