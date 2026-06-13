const db = require('../models/db');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const cloudinary = require('../utils/cloudinary');

const uploadBufferToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'raw'
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
    }
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
};

const uploadNote = async (req, res) => {
  let uploadedPdf;
  let uploadedPreview;

  try {
    const {
      subject,
      level,
      language,
      title,
      description,
      price,
      preview_enabled,
      tags
    } = req.body;

    const file = req.file;

    if (!subject || !title || !price || !file) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const notePrice = Number(price);

    if (Number.isNaN(notePrice) || notePrice < 0) {
      return res.status(400).json({ error: 'Invalid price.' });
    }

    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed.' });
    }

    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const mainPublicId = `note-${uniqueId}.pdf`;

    uploadedPdf = await uploadBufferToCloudinary(
      file.buffer,
      'noteshalla/notes',
      mainPublicId
    );

    const isPreviewEnabled =
      preview_enabled === 'true' || preview_enabled === true;

    if (isPreviewEnabled) {
      try {
        const pdfDoc = await PDFDocument.load(file.buffer);

        if (pdfDoc.getPageCount() < 1) {
          await deleteFromCloudinary(uploadedPdf.public_id);
          return res.status(400).json({ error: 'PDF has no pages.' });
        }

        const previewDoc = await PDFDocument.create();
        const [firstPage] = await previewDoc.copyPages(pdfDoc, [0]);
        previewDoc.addPage(firstPage);

        const { height } = firstPage.getSize();

        firstPage.drawText('PREVIEW ONLY', {
          x: 50,
          y: height / 2,
          size: 60,
          color: rgb(0.95, 0.1, 0.1),
          opacity: 0.3,
          rotate: degrees(45)
        });

        const previewPdfBytes = await previewDoc.save();

        uploadedPreview = await uploadBufferToCloudinary(
          Buffer.from(previewPdfBytes),
          'noteshalla/previews',
          `preview-${uniqueId}.pdf`
        );
      } catch (pdfErr) {
        await deleteFromCloudinary(uploadedPdf?.public_id);
        console.error('PDF preview generation error:', pdfErr);
        return res.status(400).json({
          error: 'Invalid or encrypted PDF. Preview could not be generated.'
        });
      }
    }

    const result = await db.query(
      `INSERT INTO notes 
       (seller_id, subject, level, language, title, description, price, file_path, file_public_id, preview_file_url, preview_public_id, preview_enabled) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        subject,
        level || 'Beginner',
        language || 'English',
        title,
        description || '',
        notePrice,
        uploadedPdf.secure_url,
        uploadedPdf.public_id,
        uploadedPreview?.secure_url || null,
        uploadedPreview?.public_id || null,
        isPreviewEnabled
      ]
    );

    const noteId = result.insertId;

    if (tags) {
      const tagsArray = Array.isArray(tags)
        ? tags
        : tags.split(',').map((tag) => tag.trim());

      for (const tag of tagsArray) {
        if (tag) {
          await db.query(
            'INSERT IGNORE INTO tags (note_id, tag_name) VALUES (?, ?)',
            [noteId, tag]
          );
        }
      }
    }

    return res.status(201).json({
      message: 'Note uploaded successfully',
      noteId
    });
  } catch (err) {
    await deleteFromCloudinary(uploadedPdf?.public_id);
    await deleteFromCloudinary(uploadedPreview?.public_id);

    console.error('Upload note error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const getNotes = async (req, res) => {
  try {
    const { search, subject, level, minPrice, maxPrice } = req.query;

    let query =
        `SELECT 
            n.id, n.seller_id, n.subject, n.level, n.language,
            n.title, n.description, n.price, n.preview_enabled, n.created_at,
            u.name as seller_name
        FROM notes n
        JOIN users u ON n.seller_id = u.id
        WHERE 1=1`;
    const params = [];

    if (search) {
      query += ' AND (n.title LIKE ? OR n.description LIKE ? OR n.subject LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (subject) {
      query += ' AND n.subject = ?';
      params.push(subject);
    }

    if (level) {
      query += ' AND n.level = ?';
      params.push(level);
    }

    if (minPrice) {
      query += ' AND n.price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      query += ' AND n.price <= ?';
      params.push(Number(maxPrice));
    }

    query += ' ORDER BY n.created_at DESC';

    const notes = await db.query(query, params);
    return res.json({ notes });
  } catch (err) {
    console.error('Get notes error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const getNoteDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const notes = await db.query(
        `SELECT 
            n.id, n.seller_id, n.subject, n.level, n.language,
            n.title, n.description, n.price, n.preview_enabled, n.created_at,
            u.name as seller_name
        FROM notes n
        JOIN users u ON n.seller_id = u.id
        WHERE n.id = ?`,
        [id]
    );

    if (notes.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = notes[0];

    const tags = await db.query('SELECT tag_name FROM tags WHERE note_id = ?', [id]);
    note.tags = tags.map((t) => t.tag_name);

    return res.json({ note });
  } catch (err) {
    console.error('Get note details error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const previewNote = async (req, res) => {
  try {
    const { id } = req.params;

    const notes = await db.query('SELECT * FROM notes WHERE id = ?', [id]);

    if (notes.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = notes[0];

    if (!note.preview_enabled || !note.preview_file_url) {
      return res.status(403).json({ error: 'Preview not enabled for this note.' });
    }

    return res.redirect(note.preview_file_url);
    // return res.setHeader('Content-Type', 'application/pdf').redirect(note.preview_file_url);
    // return res.json({ previewUrl: note.preview_file_url });
  } catch (err) {
    console.error('Preview note error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const downloadNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notes = await db.query('SELECT * FROM notes WHERE id = ?', [id]);

    if (notes.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = notes[0];

    if (Number(note.seller_id) !== Number(userId)) {
      const purchases = await db.query(
        'SELECT id FROM purchases WHERE buyer_id = ? AND note_id = ?',
        [userId, id]
      );

      if (purchases.length === 0) {
        return res.status(403).json({
          error: 'Please purchase the note to download the full version.'
        });
      }
    }

    return res.redirect(note.file_path);
  } catch (err) {
    console.error('Download note error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  uploadNote,
  getNotes,
  getNoteDetails,
  previewNote,
  downloadNote
};