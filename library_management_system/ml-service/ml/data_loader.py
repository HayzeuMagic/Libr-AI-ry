# ml-service/ml/data_loader.py
import mysql.connector
import pandas as pd
from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB


def get_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
    )


def load_interactions():
    """
    Return a DataFrame with columns: user_id, book_id, interaction_strength.
    interaction_strength = number of times the user borrowed the book.

    Borrows are recorded by the Django backend in reservations_reservation
    (the old `borrow_history` table never existed and nothing wrote to it).
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, book_id, COUNT(*) AS interaction_strength
            FROM reservations_reservation
            WHERE book_id IS NOT NULL
            GROUP BY user_id, book_id
            """
        )
        rows = cursor.fetchall()
        cursor.close()
        return pd.DataFrame(rows, columns=['user_id', 'book_id', 'interaction_strength'])
    finally:
        conn.close()
