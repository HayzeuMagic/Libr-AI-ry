const pool = require('../config/db');

async function logSearch({ userId, queryText, bookId, resultCount, clicked }) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO search_history (user_id, query_text, book_id, searched_at, result_count, clicked)
       VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
      [
        userId || null,
        queryText,
        bookId || null,
        typeof resultCount === 'number' ? resultCount : null,
        clicked ? 1 : 0,
      ]
    );
    return result.insertId;
  } finally {
    conn.release();
  }
}

module.exports = {
  logSearch,
};