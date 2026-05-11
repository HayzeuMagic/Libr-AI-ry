// src/controllers/recommendationController.js
const recommendationService = require('../services/recommendationService');

async function getRecommendedForUser(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const topK = parseInt(req.query.limit, 10) || 10;

    const items = await recommendationService.getRecommendedForUser(userId, topK);

    return res.status(200).json({
      userId,
      limit: topK,
      items,
    });
  } catch (err) {
    console.error('Error in getRecommendedForUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getStudentsAlsoBorrowed(req, res) {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (!bookId) {
      return res.status(400).json({ message: 'Invalid bookId' });
    }

    const topK = parseInt(req.query.limit, 10) || 10;

    const items = await recommendationService.getStudentsAlsoBorrowed(bookId, topK);

    return res.status(200).json({
      bookId,
      limit: topK,
      items,
    });
  } catch (err) {
    console.error('Error in getStudentsAlsoBorrowed:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getRecommendedForUser,
  getStudentsAlsoBorrowed,
};