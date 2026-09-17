"""
Seed demo credentials and mock user planet submissions in exoplanets.db.
"""
import json
import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from extensions import db
from models.user import User, UserRole
from models.exoplanet import Exoplanet, PlanetStatus
from werkzeug.security import generate_password_hash

def seed_demo():
    with app.app_context():
        print("Seeding Demo Users and Mock Data into exoplanets.db...")

        # 1. Seed or update Demo User
        demo_user = User.query.filter_by(username="demo_astronomer").first()
        if not demo_user:
            demo_user = User(
                username="demo_astronomer",
                email="demo@exohabit.ai",
                password_hash=generate_password_hash("Password123!"),
                role=UserRole.USER,
                is_active=True,
            )
            db.session.add(demo_user)
            db.session.flush()
            print("Created demo user: demo_astronomer / Password123!")
        else:
            demo_user.password_hash = generate_password_hash("Password123!")
            demo_user.is_active = True
            db.session.flush()
            print("Updated demo user password: Password123!")

        # 2. Seed or update Admin User
        admin_user = User.query.filter_by(username="admin_demo").first()
        if not admin_user:
            admin_user = User(
                username="admin_demo",
                email="admin@exohabit.ai",
                password_hash=generate_password_hash("AdminPassword123!"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.session.add(admin_user)
            db.session.flush()
            print("Created admin user: admin_demo / AdminPassword123!")
        else:
            admin_user.password_hash = generate_password_hash("AdminPassword123!")
            admin_user.role = UserRole.ADMIN
            admin_user.is_active = True
            db.session.flush()
            print("Updated admin user password: AdminPassword123!")

        user_id = demo_user.id
        now = datetime.now(timezone.utc)

        mock_planets = [
            {
                "planet_name": "Kepler-452b Prime",
                "P_RADIUS": 1.11,
                "P_MASS": 1.45,
                "P_DENSITY": 5.82,
                "P_TEMP_SURF": 278.5,
                "P_PERIOD": 384.8,
                "P_SEMI_MAJOR_AXIS": 1.046,
                "S_TEMPERATURE": 5757.0,
                "S_LUMINOSITY": 1.20,
                "S_METALLICITY": 0.21,
                "habitability_probability": 0.892,
                "habitability": 1,
                "status": PlanetStatus.APPROVED,
                "rejection_reason": None,
                "created_at": now - timedelta(days=5),
            },
            {
                "planet_name": "Proxima Centauri d-Sim",
                "P_RADIUS": 0.81,
                "P_MASS": 0.26,
                "P_DENSITY": 4.95,
                "P_TEMP_SURF": 298.0,
                "P_PERIOD": 5.12,
                "P_SEMI_MAJOR_AXIS": 0.029,
                "S_TEMPERATURE": 3042.0,
                "S_LUMINOSITY": 0.0017,
                "S_METALLICITY": -0.07,
                "habitability_probability": 0.741,
                "habitability": 1,
                "status": PlanetStatus.APPROVED,
                "rejection_reason": None,
                "created_at": now - timedelta(days=4),
            },
            {
                "planet_name": "TRAPPIST-1e Candidate",
                "P_RADIUS": 0.92,
                "P_MASS": 0.69,
                "P_DENSITY": 5.65,
                "P_TEMP_SURF": 251.0,
                "P_PERIOD": 6.10,
                "P_SEMI_MAJOR_AXIS": 0.028,
                "S_TEMPERATURE": 2566.0,
                "S_LUMINOSITY": 0.0005,
                "S_METALLICITY": 0.04,
                "habitability_probability": 0.934,
                "habitability": 1,
                "status": PlanetStatus.PENDING,
                "rejection_reason": None,
                "created_at": now - timedelta(hours=14),
            },
            {
                "planet_name": "LHS 1140 b Variant",
                "P_RADIUS": 1.43,
                "P_MASS": 6.65,
                "P_DENSITY": 7.50,
                "P_TEMP_SURF": 235.0,
                "P_PERIOD": 24.7,
                "P_SEMI_MAJOR_AXIS": 0.094,
                "S_TEMPERATURE": 3216.0,
                "S_LUMINOSITY": 0.0044,
                "S_METALLICITY": -0.15,
                "habitability_probability": 0.825,
                "habitability": 1,
                "status": PlanetStatus.PENDING,
                "rejection_reason": None,
                "created_at": now - timedelta(hours=6),
            },
            {
                "planet_name": "WASP-12b Synthetic",
                "P_RADIUS": 19.3,
                "P_MASS": 448.0,
                "P_DENSITY": 0.33,
                "P_TEMP_SURF": 2525.0,
                "P_PERIOD": 1.09,
                "P_SEMI_MAJOR_AXIS": 0.023,
                "S_TEMPERATURE": 6300.0,
                "S_LUMINOSITY": 2.10,
                "S_METALLICITY": 0.30,
                "habitability_probability": 0.012,
                "habitability": 0,
                "status": PlanetStatus.REJECTED,
                "rejection_reason": "Surface temperature of 2525K is biologically non-viable; tidal heating exceeds habitable equilibrium thresholds.",
                "created_at": now - timedelta(days=2),
            },
            {
                "planet_name": "Gliese 581g Resubmission",
                "P_RADIUS": 1.50,
                "P_MASS": 3.10,
                "P_DENSITY": 5.10,
                "P_TEMP_SURF": 228.0,
                "P_PERIOD": 36.6,
                "P_SEMI_MAJOR_AXIS": 0.146,
                "S_TEMPERATURE": 3480.0,
                "S_LUMINOSITY": 0.013,
                "S_METALLICITY": -0.10,
                "habitability_probability": 0.618,
                "habitability": 1,
                "status": PlanetStatus.REJECTED,
                "rejection_reason": "Duplicate candidate record. Unverified radial velocity signal without high-resolution RV or transit spectroscopic confirmation.",
                "created_at": now - timedelta(days=1),
            },
        ]

        for p_data in mock_planets:
            existing = Exoplanet.query.filter_by(planet_name=p_data["planet_name"]).first()
            if existing:
                for k, v in p_data.items():
                    setattr(existing, k, v)
                existing.created_by_user_id = user_id
                existing.is_user_generated = True
                existing.model_version = "v2_pipeline_gradient_boosting"
                existing.raw_input_json = json.dumps(p_data, default=str)
                print(f"Updated mock planet: {p_data['planet_name']} ({p_data['status']})")
            else:
                planet = Exoplanet(
                    planet_name=p_data["planet_name"],
                    P_RADIUS=p_data["P_RADIUS"],
                    P_MASS=p_data["P_MASS"],
                    P_DENSITY=p_data["P_DENSITY"],
                    P_TEMP_SURF=p_data["P_TEMP_SURF"],
                    P_PERIOD=p_data["P_PERIOD"],
                    P_SEMI_MAJOR_AXIS=p_data["P_SEMI_MAJOR_AXIS"],
                    S_TEMPERATURE=p_data["S_TEMPERATURE"],
                    S_LUMINOSITY=p_data["S_LUMINOSITY"],
                    S_METALLICITY=p_data["S_METALLICITY"],
                    habitability_probability=p_data["habitability_probability"],
                    habitability=p_data["habitability"],
                    model_version="v2_pipeline_gradient_boosting",
                    status=p_data["status"],
                    rejection_reason=p_data["rejection_reason"],
                    raw_input_json=json.dumps(p_data, default=str),
                    is_user_generated=True,
                    created_at=p_data["created_at"],
                    created_by_user_id=user_id,
                )
                db.session.add(planet)
                print(f"Created mock planet: {p_data['planet_name']} ({p_data['status']})")

        db.session.commit()
        print("Mock demo data seeded successfully!")

if __name__ == "__main__":
    seed_demo()
