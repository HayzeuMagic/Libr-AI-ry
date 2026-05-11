const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Most borrowed books in a time range
router.get('/most-borrowed', analyticsController.getMostBorrowed);

// User borrowing history (for profile/analytics)
router.get('/user/:userId/history', analyticsController.getUserHistory);

module.exports = router;