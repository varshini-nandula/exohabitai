"""
ExoHabitAI — Database Migration Script
=======================================
Adds new columns/tables introduced by backend upgrades to the existing
SQLite database without dropping data.

Managed columns (exoplanets table):
    - is_user_generated    BOOLEAN  DEFAULT FALSE
    - updated_at           DATETIME
    - model_version        VARCHAR(50)
    - created_by_user_id   INTEGER FK→users(id)

Managed tables:
    - users                (JWT authentication)

This script is idempotent — safe to run multiple times.

Usage:
    cd backend
    python migrate_db.py
"""

import sqlite3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.migrate")

# Resolve the same DB path Flask uses
DB_PATH = os.path.join("instance", "exoplanets.db")


def get_existing_columns(cursor, table: str) -> set:
    """Return the set of column names in *table*."""
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def migrate():
    if not os.path.isfile(DB_PATH):
        logger.info("Database file not found at %s — nothing to migrate "
                     "(it will be created fresh on first app start)", DB_PATH)
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    existing = get_existing_columns(cursor, "exoplanets")
    logger.info("Existing columns: %s", sorted(existing))

    migrations_applied = 0

    # ── is_user_generated ────────────────────────────────────────────
    if "is_user_generated" not in existing:
        logger.info("Adding column: is_user_generated (BOOLEAN DEFAULT 0)")
        cursor.execute(
            "ALTER TABLE exoplanets ADD COLUMN is_user_generated BOOLEAN "
            "NOT NULL DEFAULT 0"
        )
        migrations_applied += 1
    else:
        logger.info("Column is_user_generated already exists — skipping")

    # ── updated_at ───────────────────────────────────────────────────
    if "updated_at" not in existing:
        logger.info("Adding column: updated_at (DATETIME)")
        # SQLite doesn't allow non-constant defaults in ALTER TABLE,
        # so we add with no default and backfill immediately.
        cursor.execute(
            "ALTER TABLE exoplanets ADD COLUMN updated_at DATETIME"
        )
        # Back-fill from created_at
        cursor.execute(
            "UPDATE exoplanets SET updated_at = created_at "
            "WHERE updated_at IS NULL"
        )
        migrations_applied += 1
    else:
        logger.info("Column updated_at already exists — skipping")

    # ── model_version ────────────────────────────────────────────────
    if "model_version" not in existing:
        logger.info("Adding column: model_version (VARCHAR(50))")
        cursor.execute(
            "ALTER TABLE exoplanets ADD COLUMN model_version VARCHAR(50)"
        )
        migrations_applied += 1
    else:
        logger.info("Column model_version already exists — skipping")

    # ── created_by_user_id (user ownership tracking) ─────────────────
    if "created_by_user_id" not in existing:
        logger.info("Adding column: created_by_user_id (INTEGER)")
        cursor.execute(
            "ALTER TABLE exoplanets ADD COLUMN created_by_user_id INTEGER "
            "REFERENCES users(id)"
        )
        migrations_applied += 1
    else:
        logger.info("Column created_by_user_id already exists — skipping")

    # ── users table ──────────────────────────────────────────────────
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    )
    if cursor.fetchone() is None:
        logger.info("Creating table: users")
        cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(80) NOT NULL UNIQUE,
                email VARCHAR(120) NOT NULL UNIQUE,
                password_hash VARCHAR(256) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME,
                last_login_at DATETIME
            )
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)"
        )
        migrations_applied += 1
    else:
        logger.info("Table users already exists — skipping")

    conn.commit()
    conn.close()

    if migrations_applied:
        logger.info("Migration complete — %d column(s) added", migrations_applied)
    else:
        logger.info("No migrations needed — database schema is up to date")


if __name__ == "__main__":
    migrate()
