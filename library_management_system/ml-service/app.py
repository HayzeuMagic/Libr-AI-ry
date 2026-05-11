from flask import Flask, request, jsonify
from ml.data_loader import load_interactions
from ml.model import RecommendationModel

app = Flask(__name__)

# Initialize a global model instance (simple in-memory model)
rec_model = RecommendationModel()

@app.route("/ml/train", methods=["POST"])
def train():
    try:
        # Load user-book interactions from DB
        interactions_df = load_interactions()
        rec_model.train(interactions_df)
        return jsonify({"message": "Model trained", "num_users": rec_model.num_users, "num_books": rec_model.num_books}), 200
    except Exception as e:
        print("Error in /ml/train:", e)
        return jsonify({"message": "Internal server error"}), 500

@app.route("/ml/recommend/user", methods=["POST"])
def recommend_for_user():
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        top_k = data.get("top_k", 10)

        if user_id is None:
            return jsonify({"message": "user_id is required"}), 400

        recommendations = rec_model.recommend_for_user(user_id, top_k=top_k)
        return jsonify({"user_id": user_id, "recommendations": recommendations}), 200
    except Exception as e:
        print("Error in /ml/recommend/user:", e)
        return jsonify({"message": "Internal server error"}), 500

@app.route("/ml/recommend/also-borrowed", methods=["POST"])
def recommend_also_borrowed():
    try:
        data = request.get_json()
        book_id = data.get("book_id")
        top_k = data.get("top_k", 10)

        if book_id is None:
            return jsonify({"message": "book_id is required"}), 400

        recommendations = rec_model.recommend_also_borrowed(book_id, top_k=top_k)
        return jsonify({"book_id": book_id, "recommendations": recommendations}), 200
    except Exception as e:
        print("Error in /ml/recommend/also-borrowed:", e)
        return jsonify({"message": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)