const searchService = require('../services/searchService');

async function logSearch(req, res) {
  try {
    const { userId, queryText, bookId, resultCount, clicked } = req.body;

    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({ message: 'queryText is required' });
    }

    const searchId = await searchService.logSearch({
      userId,
      queryText,
      bookId,
      resultCount,
      clicked,
    });

    return res.status(201).json({
      message: 'Search logged',
      searchId,
    });
  } catch (err) {
    console.error('Error in logSearch:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  logSearch,
};