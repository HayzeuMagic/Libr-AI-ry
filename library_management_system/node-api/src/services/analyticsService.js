const pool = require('../config/db');

async function getMostBorrowed({ days = 7, limit = 10 }) {
  const conn = await pool.getConnection();
  try {
    const daysInt = Number(days) || 7;
    const limitInt = Number(limit) || 10;

    // Ensure limit is a safe small integer
    const safeLimit = Math.max(1, Math.min(limitInt, 100));

    const sql = `
      SELECT 
        b.id AS bookId,
        b.title,
        b.author,
        b.genre,
        COUNT(*) AS borrowCount
      FROM borrow_history bh
      JOIN books_book b ON bh.book_id = b.id
      WHERE bh.borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY b.id, b.title, b.author, b.genre
      ORDER BY borrowCount DESC
      LIMIT ${safeLimit}
    `;

    const [rows] = await conn.execute(sql, [daysInt]);
    return rows;
  } finally {
    conn.release();
  }
}

async function getUserHistory(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT 
         bh.id AS borrowId,
         bh.book_id AS bookId,
         b.title,
         b.author,
         bh.borrow_date AS borrowDate,
         bh.return_date AS returnDate,
         bh.status
       FROM borrow_history bh
       JOIN books_book b ON bh.book_id = b.id
       WHERE bh.user_id = ?
       ORDER BY bh.borrow_date DESC`,
      [userId]
    );
    return rows;
  } finally {
    conn.release();
  }
}

module.exports = {
  getMostBorrowed,
  getUserHistory,
};