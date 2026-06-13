const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/:noteId/reviews', reviewsController.getReviews);
router.post('/:noteId/reviews', authenticateToken, reviewsController.addReview);

module.exports = router;
