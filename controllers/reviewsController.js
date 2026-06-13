const db = require('../models/db');

const addReview = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }

        // Check if user purchased the note
        const purchases = await db.query('SELECT * FROM purchases WHERE buyer_id = ? AND note_id = ?', [userId, noteId]);
        if (purchases.length === 0) {
            return res.status(403).json({ error: 'You can only review notes you have purchased.' });
        }

        // Check if already reviewed
        const existing = await db.query('SELECT * FROM reviews WHERE user_id = ? AND note_id = ?', [userId, noteId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this note.' });
        }

        // Insert review
        await db.query('INSERT INTO reviews (user_id, note_id, rating, comment) VALUES (?, ?, ?, ?)', [userId, noteId, rating, comment]);

        res.json({ message: 'Review added successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getReviews = async (req, res) => {
    try {
        const { noteId } = req.params;

        const reviews = await db.query(`
            SELECT r.*, u.name as user_name 
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.note_id = ? 
            ORDER BY r.created_at DESC
        `, [noteId]);

        const avgQuery = await db.query('SELECT AVG(rating) as average_rating FROM reviews WHERE note_id = ?', [noteId]);
        const average_rating = avgQuery[0].average_rating ? parseFloat(avgQuery[0].average_rating).toFixed(1) : 0;

        res.json({ reviews, average_rating });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

module.exports = { addReview, getReviews };
