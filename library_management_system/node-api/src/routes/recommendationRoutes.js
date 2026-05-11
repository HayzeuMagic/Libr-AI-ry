// src/routes/recommendationRoutes.js
const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

// Personalized recommendations for a user
router.get('/user/:userId', recommendationController.getRecommendedForUser);

// "Students Also Borrowed" for a book
router.get('/book/:bookId/also-borrowed', recommendationController.getStudentsAlsoBorrowed);

module.exports = router;