const express = require('express');
const router = express.Router();

const transactionsController = require('../controllers/transactionsController');
const { authenticateToken } = require('../middleware/auth');

router.post('/purchase', authenticateToken, transactionsController.purchaseNote);

router.post(
  '/add-funds',
  authenticateToken,
  transactionsController.addDummyFunds
);
module.exports = router;