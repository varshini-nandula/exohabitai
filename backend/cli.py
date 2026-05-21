"""
ExoHabitAI — Flask CLI Commands
=================================
Management commands for admin operations that should NOT be exposed via API.

Usage:
    cd backend
    flask create-admin                           # interactive prompts
    flask create-admin --username admin --email admin@exohabitai.com --password secret123

Why CLI for admin creation?
    Admin accounts grant elevated privileges (trigger retraining, view logs,
    moderate submissions). Exposing admin creation via a public API endpoint
    would be a privilege escalation vulnerability. CLI commands require
    server access, which is the correct trust boundary for admin operations.
"""

import os
import sys
import click
import logging

logger = logging.getLogger("exohabitai.cli")


def register_cli_commands(app):
    """Register custom Flask CLI commands with the application."""

    @app.cli.command("create-admin")
    @click.option("--username", prompt=True, help="Admin username")
    @click.option("--email", prompt=True, help="Admin email address")
    @click.option(
        "--password", prompt=True, hide_input=True, confirmation_prompt=True,
        help="Admin password",
    )
    def create_admin(username, email, password):
        """Create an admin user account."""
        from auth.services import create_admin_user

        user, message = create_admin_user(username, email, password)
        if user:
            click.echo(f"Admin user created: {user.username} ({user.email})")
        else:
            click.echo(f"Error: {message}", err=True)
            sys.exit(1)

    @app.cli.command("bootstrap-admin")
    def bootstrap_admin():
        """
        Create an admin from environment variables (for CI/CD and first-run).

        Reads:
            ADMIN_USERNAME (default: admin)
            ADMIN_EMAIL    (default: admin@exohabitai.local)
            ADMIN_PASSWORD (required — no default for security)

        Idempotent: skips if the username already exists.
        """
        from models.user import User
        from auth.services import create_admin_user

        username = os.getenv("ADMIN_USERNAME", "admin")
        email = os.getenv("ADMIN_EMAIL", "admin@exohabitai.local")
        password = os.getenv("ADMIN_PASSWORD")

        if not password:
            click.echo(
                "Error: ADMIN_PASSWORD env var is required for bootstrap-admin",
                err=True,
            )
            sys.exit(1)

        # Idempotent — skip if already exists
        existing = User.query.filter_by(username=username).first()
        if existing:
            click.echo(f"Admin '{username}' already exists — skipping")
            return

        user, message = create_admin_user(username, email, password)
        if user:
            click.echo(f"Bootstrap admin created: {user.username}")
        else:
            click.echo(f"Error: {message}", err=True)
            sys.exit(1)

    @app.cli.command("list-users")
    def list_users():
        """List all registered users (admin tool)."""
        from models.user import User

        users = User.query.all()
        if not users:
            click.echo("No users found.")
            return

        click.echo(f"{'ID':>4}  {'Username':<20}  {'Email':<30}  {'Role':<10}  {'Active':<6}")
        click.echo("-" * 80)
        for u in users:
            click.echo(
                f"{u.id:>4}  {u.username:<20}  {u.email:<30}  "
                f"{u.role:<10}  {'Yes' if u.is_active else 'No':<6}"
            )
