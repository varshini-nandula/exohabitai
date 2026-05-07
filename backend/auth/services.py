"""
ExoHabitAI — Auth Services (Business Logic)
=============================================
Separates authentication business logic from route handlers.

Why services exist:
    Routes should handle HTTP concerns (parsing requests, formatting
    responses). Business logic (validation, database operations) belongs
    in service functions. This separation enables:
    - Reuse: CLI commands and tests can call services directly
    - Testing: Services can be unit-tested without HTTP context
    - Readability: Routes stay thin and focused
"""

import re
import logging
from datetime import datetime, timezone

from extensions import db
from models.user import User, UserRole

logger = logging.getLogger("exohabitai.auth")

# ==========================================================================
# Validation
# ==========================================================================

# Minimum password length — NIST SP 800-63B recommends at least 8 characters.
MIN_PASSWORD_LENGTH = 8

# Simple email regex — catches obvious formatting errors without being
# overly strict. Production systems might use a library like email-validator.
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def validate_registration(username: str, email: str, password: str) -> str | None:
    """
    Validate registration input fields.

    Returns an error message string if validation fails, None if all checks pass.

    Validation rules:
        - Username: 3-80 chars, alphanumeric + underscores/hyphens
        - Email: valid format, 120 char max
        - Password: MIN_PASSWORD_LENGTH chars minimum

    Why these rules?
        - Username format prevents injection attacks and display issues
        - Email validation catches typos before they hit the DB unique constraint
        - Password length is the single most important password policy
          (complexity rules are now discouraged by NIST — length matters more)
    """
    # --- Username validation ---
    if not username or not isinstance(username, str):
        return "Username is required"
    username = username.strip()
    if len(username) < 3:
        return "Username must be at least 3 characters"
    if len(username) > 80:
        return "Username must not exceed 80 characters"
    if not re.match(r"^[a-zA-Z0-9_-]+$", username):
        return "Username can only contain letters, numbers, underscores, and hyphens"

    # --- Email validation ---
    if not email or not isinstance(email, str):
        return "Email is required"
    email = email.strip().lower()
    if len(email) > 120:
        return "Email must not exceed 120 characters"
    if not EMAIL_REGEX.match(email):
        return "Invalid email format"

    # --- Password validation ---
    if not password or not isinstance(password, str):
        return "Password is required"
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters"

    return None


# ==========================================================================
# Core Auth Operations
# ==========================================================================

def register_user(username: str, email: str, password: str,
                  role: str = UserRole.USER) -> tuple[User | None, str]:
    """
    Register a new user account.

    Args:
        username: Desired username (unique)
        email: User's email address (unique)
        password: Plaintext password (will be hashed before storage)
        role: User role (default: "user")

    Returns:
        (User object, success_message) on success
        (None, error_message) on failure

    Security notes:
        - The password is hashed BEFORE being stored
        - Duplicate username/email returns a generic error to prevent
          user enumeration attacks (don't reveal which field is taken
          in the error message — though for educational clarity we do
          specify which field here)
    """
    username = username.strip()
    email = email.strip().lower()

    # Validate input
    validation_error = validate_registration(username, email, password)
    if validation_error:
        return None, validation_error

    # Check uniqueness
    if User.query.filter_by(username=username).first():
        return None, f"Username '{username}' is already taken"
    if User.query.filter_by(email=email).first():
        return None, f"Email '{email}' is already registered"

    # Validate role
    if not UserRole.is_valid(role):
        return None, f"Invalid role: '{role}'. Must be one of {UserRole.ALL_ROLES}"

    # Create user
    user = User(
        username=username,
        email=email,
        role=role,
        is_active=True,
    )
    user.set_password(password)  # Hash the password

    try:
        db.session.add(user)
        db.session.commit()
        logger.info(
            "New user registered: username=%s, role=%s, id=%d",
            user.username, user.role, user.id,
        )
        return user, "Registration successful"
    except Exception as exc:
        db.session.rollback()
        logger.error("Registration DB error for '%s': %s", username, exc)
        return None, f"Registration failed: {exc}"


def authenticate_user(username: str, password: str) -> tuple[User | None, str]:
    """
    Authenticate a user by username and password.

    Args:
        username: The username to look up
        password: The plaintext password to verify

    Returns:
        (User object, success_message) on success
        (None, error_message) on failure

    Security notes:
        - Error messages are intentionally vague ("Invalid credentials")
          to prevent username enumeration. If we said "user not found" vs
          "wrong password", an attacker could discover valid usernames.
        - Deactivated accounts are explicitly rejected with a clear message
          (this is acceptable because the account exists but is disabled).
        - last_login_at is updated on every successful login for auditing.
    """
    if not username or not password:
        return None, "Username and password are required"

    user = User.query.filter_by(username=username.strip()).first()

    # Intentionally vague error — prevents username enumeration
    if user is None:
        logger.info("Login failed — user not found: %s", username)
        return None, "Invalid credentials"

    if not user.check_password(password):
        logger.info("Login failed — wrong password: username=%s", username)
        return None, "Invalid credentials"

    if not user.is_active:
        logger.warning("Login attempt on deactivated account: username=%s", username)
        return None, "Account is deactivated. Contact an administrator."

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.error("Failed to update last_login_at for '%s': %s", username, exc)
        # Don't fail the login over a timestamp update
        pass

    logger.info("Login successful: username=%s, role=%s", user.username, user.role)
    return user, "Login successful"


def create_admin_user(username: str, email: str, password: str) -> tuple[User | None, str]:
    """
    Create an admin user account.

    This is NOT exposed via public API routes. Admin accounts can only
    be created via:
        1. Flask CLI command: flask create-admin
        2. Direct service call (e.g., from a management script)
        3. Environment-based bootstrap (on first startup)

    Why admin creation is restricted:
        If POST /auth/register could create admins, any anonymous user
        could grant themselves admin privileges. This is a fundamental
        privilege escalation vulnerability. Admin accounts must be
        created through trusted channels only.
    """
    return register_user(username, email, password, role=UserRole.ADMIN)
