const db = require('../models/db');

const purchaseNote = async (req, res) => {
  let connection;

  try {
    const { noteId } = req.body;
    const buyerId = req.user.id;

    if (!noteId || isNaN(Number(noteId))) {
      return res.status(400).json({ error: 'Valid noteId is required.' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const [notes] = await connection.query(
      'SELECT * FROM notes WHERE id = ? FOR UPDATE',
      [noteId]
    );

    if (notes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Note not found.' });
    }

    const note = notes[0];

    if (Number(note.seller_id) === Number(buyerId)) {
      await connection.rollback();
      return res.status(400).json({ error: 'You cannot purchase your own note.' });
    }

    const [existingPurchase] = await connection.query(
      'SELECT id FROM purchases WHERE buyer_id = ? AND note_id = ?',
      [buyerId, noteId]
    );

    if (existingPurchase.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'You have already purchased this note.' });
    }

    const [buyers] = await connection.query(
      'SELECT id, wallet_balance FROM users WHERE id = ? FOR UPDATE',
      [buyerId]
    );

    if (buyers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Buyer not found.' });
    }

    const buyer = buyers[0];
    const buyerBalance = Number(buyer.wallet_balance);
    const notePrice = Number(note.price);

    if (buyerBalance < notePrice) {
      await connection.rollback();
      return res.status(400).json({
        error:
          process.env.NODE_ENV === 'production'
            ? 'Insufficient wallet balance.'
            : 'Insufficient wallet balance. Please add dummy funds.'
      });
    }

    await connection.query(
      'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
      [notePrice, buyerId]
    );

    await connection.query(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
      [notePrice, note.seller_id]
    );

    await connection.query(
      'INSERT INTO purchases (buyer_id, note_id) VALUES (?, ?)',
      [buyerId, noteId]
    );

    await connection.query(
      `INSERT INTO transactions 
       (buyer_id, seller_id, note_id, amount, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [buyerId, note.seller_id, noteId, notePrice, 'completed']
    );

    await connection.commit();

    return res.json({ message: 'Purchase successful!' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'You have already purchased this note.' });
    }

    console.error('Purchase error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const addDummyFunds = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Dummy funds are disabled in production.' });
    }

    const amount = Number(req.body.amount);

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    if (amount > 10000) {
      return res.status(400).json({ error: 'Maximum dummy amount is 10000.' });
    }

    await db.query(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
      [amount, req.user.id]
    );

    return res.json({
      message: `Successfully added ${amount} dummy funds to wallet.`
    });
  } catch (err) {
    console.error('Add dummy funds error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  purchaseNote,
  addDummyFunds
};