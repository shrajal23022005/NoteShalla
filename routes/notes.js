const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

router.get('/', notesController.getNotes);
router.post('/', authenticateToken, upload.single('file'), notesController.uploadNote);
router.get('/:id', notesController.getNoteDetails);
router.get('/:id/preview', notesController.previewNote);
router.get('/:id/download', authenticateToken, notesController.downloadNote);

module.exports = router;
