from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import numpy as np
import joblib

# APP CONFIG
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///exoplanets.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# LOAD TRAINED MODEL 
model = joblib.load("artifacts/habitability_pipeline.pkl")
print("MODEL TYPE:", type(model))
print("HAS predict_proba:", hasattr(model, "predict_proba"))


# BASELINE FEATURES 
FEATURES = [
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

# DATABASE MODEL (SQLAlchemy)
class Exoplanet(db.Model):
    __tablename__ = "exoplanets"

    id = db.Column(db.Integer, primary_key=True)
    planet_name = db.Column(db.String(150), unique=True, nullable=False)

    P_RADIUS = db.Column(db.Float)
    P_MASS = db.Column(db.Float)
    P_DENSITY = db.Column(db.Float)
    P_TEMP_SURF = db.Column(db.Float)
    P_PERIOD = db.Column(db.Float)
    P_SEMI_MAJOR_AXIS = db.Column(db.Float)
    S_TEMPERATURE = db.Column(db.Float)
    S_LUMINOSITY = db.Column(db.Float)
    S_METALLICITY = db.Column(db.Float)

    habitability_probability = db.Column(db.Float)
    habitability = db.Column(db.Integer)

with app.app_context():
    db.create_all()

# STANDARD JSON RESPONSE FORMAT
def make_response(status, message, data=None, code=200):
    return jsonify({
        "status": status,
        "message": message,
        "data": data
    }), code

# HEALTH CHECK
@app.route("/", methods=["GET"])
def health():
    return make_response(
        "success",
        "ExoHabitAI Backend running"
    )

# API 1: ADD PLANET TO DATABASE
@app.route("/add_planet", methods=["POST"])
def add_planet():
    try:
        data = request.get_json()

        planet = Exoplanet(
            planet_name=data["planet_name"],
            **{f: data[f] for f in FEATURES}
        )

        db.session.add(planet)
        db.session.commit()

        return make_response(
            "success",
            "Planet added successfully"
        )

    except Exception as e:
        db.session.rollback()
        return make_response("error", str(e), code=400)

# API 2: PREDICT HABITABILITY
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # Ensure strict feature order
        X = np.array([[
            data[f] for f in FEATURES
        ]])

        probability = model.predict_proba(X)[0][1]
        habitability = int(probability >= 0.6)

        planet = Exoplanet.query.filter_by(
            planet_name=data.get("planet_name")
        ).first()

        if planet:
            planet.habitability_probability = float(probability)
            planet.habitability = habitability
            db.session.commit()

        return make_response(
            "success",
            "Prediction generated successfully",
            {
                "planet_name": data.get("planet_name", "Unknown"),
                "habitability": habitability,
                "habitability_probability": round(float(probability), 6)
            }
        )

    except Exception as e:
        return make_response("error", str(e), code=400)

# API 3: RANK PLANETS BY HABITABILITY
@app.route("/rank", methods=["GET"])
def rank_planets():
    planets = (
        Exoplanet.query
        .filter(Exoplanet.habitability_probability.isnot(None))
        .order_by(Exoplanet.habitability_probability.desc())
        .all()
    )

    ranked = [
        {
            "rank": i + 1,
            "planet_name": p.planet_name,
            "habitability_probability": round(p.habitability_probability, 6),
            "habitability": p.habitability
        }
        for i, p in enumerate(planets)
    ]

    return make_response(
        "success",
        "Planets ranked successfully",
        ranked
    )

# RUN SERVER
if __name__ == "__main__":
    app.run(debug=True)
