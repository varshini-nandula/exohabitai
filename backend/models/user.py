"""
ExoHabitAI — User Model
========================
Defines the User model for JWT authentication and role-based access control.

Security design decisions:
    1. Passwords are NEVER stored in plaintext. We use Werkzeug's
       generate_password_hash() which defaults to scrypt (or pbkdf2:sha256
       on older versions). Both are industry-standard, computationally
       expensive hashing algorithms that resist brute-force attacks.

    2. Roles are stored as a simple string column. This is extensible —
       you can add roles like "moderator", "reviewer", "data_scientist"
       without schema changes. For this project's maturity level, a string
       enum is simpler and more readable than a separate roles table.

    3. is_active allows account deactivation without data deletion.
       Deactivated users cannot authenticate but their audit trail
       (predictions, retraining requests) is preserved.

    4. last_login_at tracks login timestamps for security auditing.
       In production, this helps detect compromised accounts (e.g.,
       logins at unusual times or from unusual locations).

    5. The to_dict() method provides clean serialisation that NEVER
       exposes the password hash — a critical security requirement.
"""

from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db


class UserRole:
    """
    User role constants.

    Using a class with string constants rather than an enum keeps roles
    extensible — you can add new roles without modifying this class or
    running migrations. The DB column stores the raw string.

    Future roles might include:
        - MODERATOR: can review user submissions but not retrain
        - REVIEWER: can approve retraining but not trigger it
        - DATA_SCIENTIST: can trigger retraining but not manage users
    """
    ADMIN = "admin"
    USER = "user"

    ALL_ROLES = [ADMIN, USER]

    @classmethod
    def is_valid(cls, role: str) -> bool:
        return role in cls.ALL_ROLES


class User(db.Model):
    """
    Authenticated user account.

    Supports JWT-based authentication with role-based access control.
    Every user action (predictions, retraining triggers) can be traced
    back to a specific user for audit and governance purposes.
    """
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    # --- Identity ---
    # Username: used for display and login. Must be unique.
    username = db.Column(
        db.String(80), unique=True, nullable=False, index=True,
    )
    # Email: used for account recovery (future) and uniqueness.
    email = db.Column(
        db.String(120), unique=True, nullable=False, index=True,
    )

    # --- Authentication ---
    # NEVER stores the raw password. Only the hash is persisted.
    # Werkzeug's scrypt/pbkdf2 hashes include the salt automatically.
    password_hash = db.Column(db.String(256), nullable=False)

    # --- Authorization ---
    # Role determines what endpoints a user can access.
    # Default "user" role can predict and submit planets.
    # "admin" role can trigger retraining, view logs, manage users.
    role = db.Column(
        db.String(20), nullable=False, default=UserRole.USER,
    )

    # --- Account Status ---
    # Deactivated accounts cannot authenticate. This is preferable to
    # deletion because it preserves the audit trail (who submitted what).
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # --- Timestamps ---
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # Tracks when the user last successfully authenticated.
    # Useful for security auditing and detecting stale accounts.
    last_login_at = db.Column(db.DateTime, nullable=True)

    # -----------------------------------------------------------------
    # Password management
    # -----------------------------------------------------------------

    def set_password(self, password: str) -> None:
        """
        Hash and store the password.

        Why hashing matters:
            If the database is compromised, attackers get hashes — not
            passwords. A properly hashed password (scrypt/bcrypt/pbkdf2)
            takes years to brute-force per hash, making mass credential
            theft impractical.

        Werkzeug's generate_password_hash() handles:
            - Salt generation (unique per password)
            - Algorithm selection (scrypt preferred, pbkdf2:sha256 fallback)
            - Iteration count (high enough to resist GPU attacks)
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """
        Verify a plaintext password against the stored hash.

        Returns True if the password matches, False otherwise.
        Constant-time comparison prevents timing attacks.
        """
        return check_password_hash(self.password_hash, password)

    # -----------------------------------------------------------------
    # Serialisation
    # -----------------------------------------------------------------

    def to_dict(self) -> dict:
        """
        Safe serialisation — NEVER includes password_hash.

        This method is used for API responses (/auth/me, admin user lists).
        Exposing password hashes, even hashed ones, is a security anti-pattern.
        """
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }

    @property
    def is_admin(self) -> bool:
        """Convenience property for role checks."""
        return self.role == UserRole.ADMIN

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"
