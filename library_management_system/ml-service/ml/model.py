# ml-service/ml/model.py
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class RecommendationModel:
    def __init__(self):
        self.user_index = {}   # map user_id -> row index
        self.book_index = {}   # map book_id -> col index
        self.index_user = {}   # reverse map
        self.index_book = {}   # reverse map
        self.user_item_matrix = None  # numpy array
        self.item_similarity = None   # cosine similarity between books
        self.num_users = 0
        self.num_books = 0

    def train(self, interactions_df: pd.DataFrame):
        """
        interactions_df: columns [user_id, book_id, interaction_strength]
        Builds a user-item matrix and item-item similarity matrix.
        """
        if interactions_df.empty:
            self.user_item_matrix = None
            self.item_similarity = None
            self.user_index = {}
            self.book_index = {}
            self.index_user = {}
            self.index_book = {}
            self.num_users = 0
            self.num_books = 0
            return

        # Map user_ids and book_ids to matrix indices
        unique_users = interactions_df["user_id"].unique()
        unique_books = interactions_df["book_id"].unique()

        self.user_index = {uid: i for i, uid in enumerate(unique_users)}
        self.book_index = {bid: j for j, bid in enumerate(unique_books)}
        self.index_user = {i: uid for uid, i in self.user_index.items()}
        self.index_book = {j: bid for bid, j in self.book_index.items()}

        self.num_users = len(unique_users)
        self.num_books = len(unique_books)

        # Initialize user-item matrix
        mat = np.zeros((self.num_users, self.num_books), dtype=float)

        for _, row in interactions_df.iterrows():
            u = row["user_id"]
            b = row["book_id"]
            strength = row["interaction_strength"]
            ui = self.user_index[u]
            bi = self.book_index[b]
            mat[ui, bi] = strength

        self.user_item_matrix = mat

        # Compute item-item cosine similarity (books x books)
        if self.num_books > 0:
            # transpose to get (books x users)
            item_vectors = mat.T  # shape: (num_books, num_users)
            # sklearn cosine_similarity expects shape (n_samples, n_features)
            self.item_similarity = cosine_similarity(item_vectors)
        else:
            self.item_similarity = None

    def recommend_for_user(self, user_id, top_k=10):
        """
        Recommend top_k books for a user based on item-item similarity and user's history.
        Returns a list of dicts: [{book_id, score}, ...]
        """
        if self.user_item_matrix is None or self.item_similarity is None:
            return []

        if user_id not in self.user_index:
            # Cold start: no history; return empty for now (frontend can fall back to trending)
            return []

        user_row = self.user_index[user_id]

        # User's interaction vector (1 x num_books)
        user_vector = self.user_item_matrix[user_row, :]  # shape: (num_books,)

        # Scores for items: weighted sum of similarities to items the user interacted with
        # Basic item-based CF: score = similarity_matrix * user_vector
        scores = self.item_similarity.dot(user_vector)  # shape: (num_books,)

        # Do not recommend books the user already borrowed
        already_indices = np.where(user_vector > 0)[0]
        scores[already_indices] = -np.inf

        # Get top_k indices
        top_k = min(top_k, self.num_books)
        top_indices = np.argsort(scores)[::-1][:top_k]

        recommendations = []
        for idx in top_indices:
            # Skip already-borrowed books and books with no similarity at all.
            if not scores[idx] > 0:
                continue
            book_id = self.index_book[idx]
            score = float(scores[idx])
            recommendations.append({"book_id": int(book_id), "score": score})

        return recommendations

    def recommend_also_borrowed(self, book_id, top_k=10):
        """
        Given a book_id, return similar books using item-item cosine similarity.
        """
        if self.item_similarity is None or book_id not in self.book_index:
            return []

        book_idx = self.book_index[book_id]
        # Copy: indexing a row returns a view, so writing -inf into it used to
        # permanently corrupt the similarity matrix for every later request.
        sim_vector = self.item_similarity[book_idx].copy()

        # Exclude itself
        sim_vector[book_idx] = -np.inf

        top_k = min(top_k, self.num_books - 1)
        top_indices = np.argsort(sim_vector)[::-1][:top_k]

        recommendations = []
        for idx in top_indices:
            # Skip itself and books nobody borrowed together with this one.
            if not sim_vector[idx] > 0:
                continue
            similar_book_id = self.index_book[idx]
            score = float(sim_vector[idx])
            recommendations.append({"book_id": int(similar_book_id), "score": score})

        return recommendations