const pool = require('../config/db');

async function getTrendingBooks({ days = 7, limit = 10 }) {
  const daysInt = Math.max(1, Number(days) || 7);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

  // Borrows come from Django's reservations table; clicked searches from
  // search_history (created by ensureSchema() on startup).
  const sql = `
    SELECT
      b.id AS bookId,
      b.title,
      b.author,
      b.genre,
      b.cover_url AS coverUrl,
      IFNULL(borrows.borrowCount, 0) AS borrowCount,
      IFNULL(searches.searchCount, 0) AS searchCount,
      (IFNULL(borrows.borrowCount, 0) * 1.0 + IFNULL(searches.searchCount, 0) * 0.3) AS trendingScore
    FROM books_book b
    LEFT JOIN (
      SELECT book_id, COUNT(*) AS borrowCount
      FROM reservations_reservation
      WHERE borrow_date >= UTC_TIMESTAMP() - INTERVAL ? DAY
        AND book_id IS NOT NULL
      GROUP BY book_id
    ) AS borrows ON borrows.book_id = b.id
    LEFT JOIN (
      SELECT book_id, COUNT(*) AS searchCount
      FROM search_history
      WHERE searched_at >= UTC_TIMESTAMP() - INTERVAL ? DAY
        AND clicked = 1
        AND book_id IS NOT NULL
      GROUP BY book_id
    ) AS searches ON searches.book_id = b.id
    WHERE borrows.borrowCount IS NOT NULL OR searches.searchCount IS NOT NULL
    ORDER BY trendingScore DESC, b.title
    LIMIT ${safeLimit}
  `;

  const [rows] = await pool.execute(sql, [daysInt, daysInt]);
  return rows;
}

module.exports = {
  getTrendingBooks,
};
