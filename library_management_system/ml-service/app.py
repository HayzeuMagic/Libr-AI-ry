import threading
import time

from flask import Flask, request, jsonify

from config import ML_PORT, RETRAIN_INTERVAL
from ml.data_loader import load_interactions
from ml.model import RecommendationModel

app = Flask(__name__)

# Global in-memory model. It used to stay empty until someone manually
# POSTed /ml/train, so every recommendation request returned nothing.
rec_model = RecommendationModel()
_trained_at = 0.0
_train_lock = threading.Lock()


def train_model():
    global _trained_at
    with _train_lock:
        interactions_df = load_interactions()
        rec_model.train(interactions_df)
        _trained_at = time.time()


def ensure_fresh_model():
    if time.time() - _trained_at > RETRAIN_INTERVAL:
        train_model()


def parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@app.route("/ml/train", methods=["POST"])
def train():
    try:
        train_model()
        return jsonify({"message": "Model trained", "num_users": rec_model.num_users, "num_books": rec_model.num_books}), 200
    except Exception as e:
        print("Error in /ml/train:", e)
        return jsonify({"message": "Internal server error"}), 500


@app.route("/ml/recommend/user", methods=["POST"])
def recommend_for_user():
    try:
        data = request.get_json(silent=True) or {}
        user_id = parse_int(data.get("user_id"))
        top_k = parse_int(data.get("top_k"), 10)

        if user_id is None:
            return jsonify({"message": "user_id is required"}), 400

        ensure_fresh_model()
        recommendations = rec_model.recommend_for_user(user_id, top_k=top_k)
        return jsonify({"user_id": user_id, "recommendations": recommendations}), 200
    except Exception as e:
        print("Error in /ml/recommend/user:", e)
        return jsonify({"message": "Internal server error"}), 500


@app.route("/ml/recommend/also-borrowed", methods=["POST"])
def recommend_also_borrowed():
    try:
        data = request.get_json(silent=True) or {}
        book_id = parse_int(data.get("book_id"))
        top_k = parse_int(data.get("top_k"), 10)

        if book_id is None:
            return jsonify({"message": "book_id is required"}), 400

        ensure_fresh_model()
        recommendations = rec_model.recommend_also_borrowed(book_id, top_k=top_k)
        return jsonify({"book_id": book_id, "recommendations": recommendations}), 200
    except Exception as e:
        print("Error in /ml/recommend/also-borrowed:", e)
        return jsonify({"message": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=ML_PORT, debug=False)
