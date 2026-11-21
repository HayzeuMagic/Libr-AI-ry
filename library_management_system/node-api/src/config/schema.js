const pool = require('./db');

// Tables owned by this service. Everything else (books, users, reservations)
// is created by the Django migrations.
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_history (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NULL,
      query_text VARCHAR(512) NOT NULL,
      book_id BIGINT NULL,
      searched_at DATETIME(6) NOT NULL,
      result_count INT NULL,
      clicked TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_search_history_book_time (book_id, searched_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = { ensureSchema };
