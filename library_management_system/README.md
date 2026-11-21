# LIBR-AI-RY — local setup

Four processes make up the app:

| Service | Folder | Port | Needed for |
|---|---|---|---|
| Django API | `backend/` | 8000 | everything |
| React frontend | `frontend/` | 3000 | the UI |
| Node analytics API | `node-api/` | 4000 | Statistics page |
| Flask ML service | `ml-service/` | 5000 | "Recommended For You" on the Statistics page |

All of them use one MySQL 8 database, `library_db` (default login `root` / `password`, set in `backend/.env`).

> The Flask app in `app/` with the top-level `Dockerfile`, `docker-compose.yml` and `wsgi.py` is unused template code. It is not part of the running app.

## 1. MySQL

Use any MySQL 8 server, for example the Windows `MySQL80` service, and create the database:

```sql
CREATE DATABASE IF NOT EXISTS library_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

If you can't start the Windows service (it needs admin rights), run a private server from the installed binaries instead. Its data lives in `database/mysql-data/`, which git ignores:

```bash
mysqld --initialize-insecure --datadir="%CD%\database\mysql-data"      # first time only
mysqld --datadir="%CD%\database\mysql-data" --port=3306 --console
mysql -uroot -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'password'; CREATE DATABASE library_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 2. Django API

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env          # then set SECRET_KEY (and OPENAI_API_KEY for the AI chatbot)
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py import_books      # loads ../database/books.csv (~207k books, ~20 s); safe to re-run
venv\Scripts\python manage.py createsuperuser   # admin login (use the email to sign in)
venv\Scripts\python manage.py runserver 8000
```

Student accounts are created by an admin under **Manage Users**: upload a CSV with `name,email[,password]` columns.

E-books are added in Django admin (`http://localhost:8000/admin/`): create or edit a Book, tick **Is ebook**, and upload the PDF. Students then add it from **Our Books** and read it under **E-Books**.

Without `OPENAI_API_KEY` the chatbot still recommends and lends books from the catalogue. Only the free-form AI answers are disabled.

## 3. Frontend

```bash
cd frontend
npm ci
npm start                       # http://localhost:3000
```

## 4. Statistics services (optional)

```bash
cd node-api && npm ci && npm start                  # port 4000
cd ml-service && python -m venv venv && venv\Scripts\pip install -r requirements.txt && venv\Scripts\python app.py   # port 5000
```

Both read the same `DB_*` environment variables as Django, with the same defaults.
