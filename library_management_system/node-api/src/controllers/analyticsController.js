const analyticsService = require('../services/analyticsService');

async function getMostBorrowed(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const limit = parseInt(req.query.limit, 10) || 10;

    const data = await analyticsService.getMostBorrowed({ days, limit });

    return res.status(200).json({
      rangeDays: days,
      limit,
      items: data,
    });
  } catch (err) {
    console.error('Error in getMostBorrowed:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getUserHistory(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const history = await analyticsService.getUserHistory(userId);

    return res.status(200).json({
      userId,
      history,
    });
  } catch (err) {
    console.error('Error in getUserHistory:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getMostBorrowed,
  getUserHistory,
};