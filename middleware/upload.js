const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      return cb(null, true);
    }

    return cb(new Error('Only PDF files are allowed.'), false);
  },

  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = upload;