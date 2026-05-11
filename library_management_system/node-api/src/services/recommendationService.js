// src/services/recommendationService.js
const pool = require('../config/db');
const mlClient = require('./mlClient');

async function getRecommendedForUser(userId, topK = 10) {
  const mlResult = await mlClient.getUserRecommendations(userId, topK);
  const recs = mlResult.recommendations || [];
  if (recs.length === 0) {
    return [];
  }

  const bookIds = recs.map((r) => r.book_id);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id AS bookId, title, author, genre, cover_url
       FROM books_book
       WHERE id IN (${bookIds.map(() => '?').join(', ')})`,
      bookIds
    );

    const detailsById = {};
    for (const row of rows) {
      detailsById[row.bookId] = row;
    }

    return recs
      .filter((r) => detailsById[r.book_id])
      .map((r) => ({
        ...detailsById[r.book_id],
        score: r.score,
      }));
  } finally {
    conn.release();
  }
}

async function getStudentsAlsoBorrowed(bookId, topK = 10) {
  const mlResult = await mlClient.getAlsoBorrowed(bookId, topK);
  const recs = mlResult.recommendations || [];
  if (recs.length === 0) {
    return [];
  }

  const bookIds = recs.map((r) => r.book_id);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id AS bookId, title, author, genre, cover_url
       FROM books_book
       WHERE id IN (${bookIds.map(() => '?').join(', ')})`,
      bookIds
    );

    const detailsById = {};
    for (const row of rows) {
      detailsById[row.bookId] = row;
    }

    return recs
      .filter((r) => detailsById[r.book_id])
      .map((r) => ({
        ...detailsById[r.book_id],
        score: r.score,
      }));
  } finally {
    conn.release();
  }
}

module.exports = {
  getRecommendedForUser,
  getStudentsAlsoBorrowed,
};