const pool = require('../config/db');

async function getTrendingBooks({ days = 7, limit = 10 }) {
  const conn = await pool.getConnection();
  try {
    const daysInt = Number(days) || 7;
    const limitInt = Number(limit) || 10;
    const safeLimit = Math.max(1, Math.min(limitInt, 50));

    const sql = `
      SELECT
        b.id AS bookId,
        b.title,
        b.author,
        b.genre,
        IFNULL(borrows.borrowCount, 0) AS borrowCount,
        IFNULL(searches.searchCount, 0) AS searchCount,
        (IFNULL(borrows.borrowCount, 0) * 1.0 + IFNULL(searches.searchCount, 0) * 0.3) AS trendingScore
      FROM books_book b
      LEFT JOIN (
        SELECT 
          book_id,
          COUNT(*) AS borrowCount
        FROM borrow_history
        WHERE borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY book_id
      ) AS borrows ON borrows.book_id = b.id
      LEFT JOIN (
        SELECT 
          book_id,
          COUNT(*) AS searchCount
        FROM search_history
        WHERE searched_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND clicked = 1
        GROUP BY book_id
      ) AS searches ON searches.book_id = b.id
      WHERE borrows.borrowCount IS NOT NULL OR searches.searchCount IS NOT NULL
      ORDER BY trendingScore DESC
      LIMIT ${safeLimit}
    `;

    const [rows] = await conn.execute(sql, [daysInt, daysInt]);
    return rows;
  } finally {
    conn.release();
  }
}

module.exports = {
  getTrendingBooks,
};