"""
ExoHabitAI — Auth Module
==========================
Blueprint registration and module exports.
"""

from auth.routes import auth_bp
import auth.utils  # noqa: F401 — registers JWT callbacks

__all__ = ["auth_bp"]
