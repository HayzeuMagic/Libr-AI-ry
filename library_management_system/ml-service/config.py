import os

# Same defaults as the Django backend (backend/library_management/settings.py).
MYSQL_HOST = os.getenv('DB_HOST', 'localhost')
MYSQL_PORT = int(os.getenv('DB_PORT', '3306'))
MYSQL_USER = os.getenv('DB_USER', 'root')
MYSQL_PASSWORD = os.getenv('DB_PASSWORD', 'password')
MYSQL_DB = os.getenv('DB_NAME', 'library_db')

ML_PORT = int(os.getenv('ML_PORT', '5000'))

# Retrain the in-memory model at most this often (seconds).
RETRAIN_INTERVAL = int(os.getenv('ML_RETRAIN_INTERVAL', '60'))
