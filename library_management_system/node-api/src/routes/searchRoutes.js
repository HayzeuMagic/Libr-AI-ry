const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Log a search event
router.post('/log', searchController.logSearch);

module.exports = router;