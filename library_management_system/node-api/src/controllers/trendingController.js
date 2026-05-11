const trendingService = require('../services/trendingService');

async function getTrendingBooks(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const limit = parseInt(req.query.limit, 10) || 10;

    const items = await trendingService.getTrendingBooks({ days, limit });

    return res.status(200).json({
      rangeDays: days,
      limit,
      items,
    });
  } catch (err) {
    console.error('Error in getTrendingBooks:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getTrendingBooks,
};