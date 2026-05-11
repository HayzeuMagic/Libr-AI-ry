const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');

router.post('/', borrowController.createBorrow);
router.post('/return', borrowController.returnBorrow);

module.exports = router;