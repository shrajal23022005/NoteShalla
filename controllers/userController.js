const db = require('../models/db');

// const getDashboardStats = async (req, res) => {
//     try {
//         const userId = req.user.id;

//         // Statistics
//         const uploads = await db.query('SELECT COUNT(*) as count FROM notes WHERE seller_id = ?', [userId]);
//         const purchases = await db.query('SELECT COUNT(*) as count FROM purchases WHERE buyer_id = ?', [userId]);
//         const earningsRecord = await db.query('SELECT SUM(amount) as total FROM transactions WHERE seller_id = ? AND status = "completed"', [userId]);
        
//         const stats = {
//             totalUploads: uploads[0].count,
//             totalPurchased: purchases[0].count,
//             totalEarnings: earningsRecord[0].total || 0,
//             walletBalance: req.user.wallet_balance // Requires fresh fetch if changed
//         };

//         res.json({ stats });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Internal server error.' });
//     }
// };

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const uploads = await db.query(
            'SELECT COUNT(*) as count FROM notes WHERE seller_id = ?',
            [userId]
        );

        const purchases = await db.query(
            'SELECT COUNT(*) as count FROM purchases WHERE buyer_id = ?',
            [userId]
        );

        const earningsRecord = await db.query(
            'SELECT SUM(amount) as total FROM transactions WHERE seller_id = ? AND status = "completed"',
            [userId]
        );

        // ✅ FIX: use correct column name (wallet)
        const user = await db.query(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [userId]
        );

        const stats = {
            totalUploads: uploads[0].count || 0,
            totalPurchased: purchases[0].count || 0,
            totalEarnings: Number(earningsRecord[0].total) || 0,
            walletBalance: Number(user[0].wallet_balance) || 0
        };

        res.json({ stats });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};


const getUploadedNotes = async (req, res) => {
    try {
        const notes = await db.query(`
            SELECT n.*, (SELECT COUNT(*) FROM purchases p WHERE p.note_id = n.id) as sales_count 
            FROM notes n WHERE n.seller_id = ? ORDER BY n.created_at DESC
        `, [req.user.id]);
        res.json({ notes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getPurchasedNotes = async (req, res) => {
    try {
        const notes = await db.query(`
            SELECT n.*, p.created_at as purchaseDate, u.name as seller_name
            FROM purchases p 
            JOIN notes n ON p.note_id = n.id 
            JOIN users u ON n.seller_id = u.id
            WHERE p.buyer_id = ? ORDER BY p.created_at DESC
        `, [req.user.id]);
        res.json({ notes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getWishlist = async (req, res) => {
    try {
        const notes = await db.query(`
            SELECT n.*, w.id as wishlist_id, u.name as seller_name
            FROM wishlist w 
            JOIN notes n ON w.note_id = n.id 
            JOIN users u ON n.seller_id = u.id
            WHERE w.user_id = ? ORDER BY w.created_at DESC
        `, [req.user.id]);
        res.json({ notes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { noteId } = req.body;
        // Check if already in wishlist
        const existing = await db.query('SELECT * FROM wishlist WHERE user_id = ? AND note_id = ?', [req.user.id, noteId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Note already in wishlist.' });
        }
        await db.query('INSERT INTO wishlist (user_id, note_id) VALUES (?, ?)', [req.user.id, noteId]);
        res.json({ message: 'Added to wishlist!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { noteId } = req.params;
        await db.query('DELETE FROM wishlist WHERE user_id = ? AND note_id = ?', [req.user.id, noteId]);
        res.json({ message: 'Removed from wishlist.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getTransactions = async (req, res) => {
    try {
        const transactions = await db.query(`
            SELECT t.*, n.title as note_title
            FROM transactions t
            LEFT JOIN notes n ON t.note_id = n.id
            WHERE t.buyer_id = ? OR t.seller_id = ?
            ORDER BY t.created_at DESC
        `, [req.user.id, req.user.id]);
        
        res.json({ transactions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

module.exports = {
    getDashboardStats,
    getUploadedNotes,
    getPurchasedNotes,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    getTransactions
};
