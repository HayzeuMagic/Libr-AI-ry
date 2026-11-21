const pool = require('../config/db');

// Borrows are recorded by the Django backend in `reservations_reservation`.
// (These queries used to read a `borrow_history` table that never existed.)

async function getMostBorrowed({ days = 7, limit = 10 }) {
  const daysInt = Math.max(1, Number(days) || 7);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));

  const sql = `
    SELECT
      b.id AS bookId,
      b.title,
      b.author,
      b.genre,
      b.cover_url AS coverUrl,
      COUNT(*) AS borrowCount
    FROM reservations_reservation r
    JOIN books_book b ON r.book_id = b.id
    WHERE r.borrow_date >= UTC_TIMESTAMP() - INTERVAL ? DAY
    GROUP BY b.id, b.title, b.author, b.genre, b.cover_url
    ORDER BY borrowCount DESC, b.title
    LIMIT ${safeLimit}
  `;

  const [rows] = await pool.execute(sql, [daysInt]);
  return rows;
}

async function getUserHistory(userId) {
  const [rows] = await pool.execute(
    `SELECT
       r.id AS borrowId,
       r.book_id AS bookId,
       b.title,
       b.author,
       r.borrow_date AS borrowDate,
       r.return_date AS returnDate,
       r.status
     FROM reservations_reservation r
     JOIN books_book b ON r.book_id = b.id
     WHERE r.user_id = ?
     ORDER BY r.borrow_date DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  getMostBorrowed,
  getUserHistory,
};
