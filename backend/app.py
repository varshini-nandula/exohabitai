from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
import joblib
from datetime import datetime

# APP CONFIG
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///exoplanets.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# LOAD ARTIFACTS
pipeline = joblib.load("artifacts/habitability_pipeline.pkl")
ranking_df = pd.read_csv("artifacts/ranked_exoplanets_by_habitability.csv")

# BASELINE FEATURES
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

# DATABASE MODEL
class Exoplanet(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    planet_name = db.Column(db.String(150), unique=True, nullable=False)

    habitability_probability = db.Column(db.Float)
    prediction = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

# HEALTH CHECK
@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "message": "ExoHabitAI Backend running"
    })

# PREDICT HABITABILITY
@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json()

    # Validate features
    for feature in BASELINE_FEATURES:
        if feature not in data:
            return jsonify({
                "success": False,
                "error": f"Missing feature: {feature}"
            }), 400

    # Raw input → DataFrame
    X = pd.DataFrame([data], columns=BASELINE_FEATURES)

    # Pipeline handles scaling + prediction
    probability = pipeline.predict_proba(X)[0][1]
    prediction = "Habitable" if probability >= 0.6 else "Non-Habitable"

    # Store in DB
    planet = Exoplanet(
        planet_name=data.get("planet_name", "Unknown"),
        habitability_probability=float(probability),
        prediction=prediction
    )
    db.session.add(planet)
    db.session.commit()

    return jsonify({
        "success": True,
        "prediction": prediction,
        "habitability_probability": round(float(probability), 6)
    })

# USER RANKING
@app.route("/api/rank", methods=["GET"])
def rank():
    planets = Exoplanet.query.order_by(
        Exoplanet.habitability_probability.desc()
    ).all()

    return jsonify({
        "success": True,
        "results": [
            {
                "rank": i + 1,
                "planet_name": p.planet_name,
                "habitability_probability": round(p.habitability_probability, 6)
            }
            for i, p in enumerate(planets)
        ]
    })

# GLOBAL RANKING (CSV)
@app.route("/api/rankings/top", methods=["GET"])
def global_ranking():
    n = int(request.args.get("n", 10))
    return jsonify({
        "success": True,
        "results": ranking_df.head(n).to_dict(orient="records")
    })

# RUN SERVER
if __name__ == "__main__":
    app.run(debug=True) 