import pandas as pd
from app import app, db, Exoplanet

CSV_PATH = "artifacts/ranked_exoplanets_by_habitability.csv"

df = pd.read_csv(CSV_PATH)

BASELINE_FEATURES = [
    "P_RADIUS",
    "P_MASS",
    "P_DENSITY",
    "P_TEMP_SURF",
    "P_PERIOD",
    "P_SEMI_MAJOR_AXIS",
    "S_TEMPERATURE",
    "S_LUMINOSITY",
    "S_METALLICITY"
]

with app.app_context():
    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        planet_name = row["P_NAME"]

        # Avoid duplicates
        if Exoplanet.query.filter_by(planet_name=planet_name).first():
            skipped += 1
            continue

        # Collect baseline features if present
        feature_data = {
            f: float(row[f]) if f in df.columns and pd.notna(row[f]) else None
            for f in BASELINE_FEATURES
        }

        probability = float(row["Predicted_Habitability_Probability"])

        # Use dataset label only for seeding
        habitability = (
            int(row["P_HABITABLE_BINARY"])
            if "P_HABITABLE_BINARY" in df.columns
            else int(probability >= 0.6)
        )

        planet = Exoplanet(
            planet_name=planet_name,
            habitability_probability=probability,
            habitability=habitability,
            **feature_data
        )

        db.session.add(planet)
        inserted += 1

    db.session.commit()

print("Database seeding completed")
print(f"Inserted: {inserted}")
print(f"Skipped: {skipped}")
