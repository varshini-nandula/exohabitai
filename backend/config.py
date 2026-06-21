"""
ExoHabitAI — Application Configuration
========================================
All tuneable values are loaded from environment variables with safe defaults.

Security note:
    JWT_SECRET_KEY and SECRET_KEY MUST be changed in production.
    The defaults here are intentionally insecure to make misconfiguration
    obvious during development (the app logs a warning if defaults are used).
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()  # loads .env from the backend directory


class Config:
    """Centralised configuration — every tuneable value comes from the env."""

    # --- Flask Core ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
    DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///exoplanets.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- JWT Authentication ---
    # The JWT secret MUST differ from the Flask SECRET_KEY in production.
    # Using a separate key limits blast radius if one is compromised.
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret-change-in-prod")

    # Access token lifetime — short-lived tokens limit damage from token theft.
    # Default: 1 hour for development, recommended 15-30 min in production.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_HOURS", "1"))
    )

    # Where to look for the JWT in requests.
    # "headers" = Authorization: Bearer <token>
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # --- ML Model ---
    MODEL_PATH = os.getenv("MODEL_PATH", "artifacts/habitability_pipeline.pkl")
    THRESHOLD = float(os.getenv("THRESHOLD", "0.5"))

    # --- Retraining ---
    RETRAIN_F1_TOLERANCE = float(os.getenv("RETRAIN_F1_TOLERANCE", "0.02"))

    # --- Rate Limiting ---
    RATE_LIMIT_SECONDS = float(os.getenv("RATE_LIMIT_SECONDS", "1.0"))

    # --- CORS ---
    # Comma-separated list of allowed origins, or "*" for any (dev default).
    # In production set CORS_ORIGINS to the frontend origin(s), e.g.
    #   CORS_ORIGINS=https://exohabitai.example.com
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")


class TestConfig(Config):
    """
    Test-specific overrides.

    Uses an in-memory SQLite database so tests are fast, isolated,
    and don't touch the development database.
    """
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_SECRET_KEY = "test-jwt-secret"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    # Disable rate limiting in tests
    RATE_LIMIT_SECONDS = 0.0
