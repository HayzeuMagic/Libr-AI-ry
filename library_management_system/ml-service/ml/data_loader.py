# ml-service/ml/data_loader.py
import mysql.connector
import pandas as pd
from config import MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

def get_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
    )

def load_interactions():
    """
    Return a DataFrame with columns: user_id, book_id, interaction_strength.
    For now, interaction_strength = number of borrows per user-book.
    """
    conn = get_connection()
    try:
        query = """
            SELECT
                user_id,
                book_id,
                COUNT(*) AS interaction_strength
            FROM borrow_history
            GROUP BY user_id, book_id
        """
        df = pd.read_sql(query, conn)
        return df
    finally:
        conn.close()