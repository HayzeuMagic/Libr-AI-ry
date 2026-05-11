const pool = require('../config/db');

async function createBorrow({ userId, bookId, dueDate }) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO borrow_history (user_id, book_id, borrow_date, due_date, status)
       VALUES (?, ?, NOW(), ?, 'borrowed')`,
      [userId, bookId, dueDate || null]
    );
    return result.insertId;
  } finally {
    conn.release();
  }
}

async function returnBorrow({ userId, bookId }) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id FROM borrow_history
       WHERE user_id = ? AND book_id = ? AND status = 'borrowed'
       ORDER BY borrow_date DESC
       LIMIT 1`,
      [userId, bookId]
    );

    if (rows.length === 0) {
      return null;
    }

    const borrowId = rows[0].id;

    await conn.execute(
      `UPDATE borrow_history
       SET status = 'returned', return_date = NOW()
       WHERE id = ?`,
      [borrowId]
    );

    return borrowId;
  } finally {
    conn.release();
  }
}

module.exports = {
  createBorrow,
  returnBorrow,
};