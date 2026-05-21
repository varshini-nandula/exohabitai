"""
ExoHabitAI — Shared Extension Instances
========================================
Centralises SQLAlchemy and JWT instances to prevent circular imports.

Why this pattern matters:
    In a modular Flask app, models, routes, and services all need access
    to the `db` object. If `db` is created inside `app.py`, every module
    that imports `db` also imports `app`, creating circular dependencies.

    By instantiating `db` and `jwt` here — without binding them to an app —
    we break the import cycle. The actual `init_app()` binding happens in
    `app.py` during application factory setup.

    This is a standard Flask pattern used in production codebases.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager

# These are "unbound" instances — they don't know about any Flask app yet.
# app.py calls db.init_app(app) and jwt.init_app(app) to connect them.
db = SQLAlchemy()
jwt = JWTManager()
