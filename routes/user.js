const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.get('/stats', authenticateToken, userController.getDashboardStats);
router.get('/uploaded-notes', authenticateToken, userController.getUploadedNotes);
router.get('/purchased-notes', authenticateToken, userController.getPurchasedNotes);
router.get('/wishlist', authenticateToken, userController.getWishlist);
router.post('/wishlist', authenticateToken, userController.addToWishlist);
router.delete('/wishlist/:noteId', authenticateToken, userController.removeFromWishlist);
router.get('/transactions', authenticateToken, userController.getTransactions);

module.exports = router;
