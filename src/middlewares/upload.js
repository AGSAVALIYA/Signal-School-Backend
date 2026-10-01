const multer = require('multer');
const { badRequest, AppError } = require('../utils/errors');

const IMAGE = /^image\/(jpeg|png|webp|heic|heif)$/;
const SHEET = /(spreadsheetml|csv|excel|text\/plain)/;

const make = (accept, maxMb) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => (accept.test(file.mimetype) ? cb(null, true) : cb(badRequest('FILE_TYPE'))),
  });

// Wraps multer so its errors become our AppError format.
const single = (instance, field, optional) => (req, res, next) =>
  instance.single(field)(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE'));
    if (!err && !req.file && !optional) return next(badRequest('VALIDATION', { fields: { [field]: 'REQUIRED' } }));
    return next(err);
  });

module.exports = {
  image: (field = 'photo', { optional = false } = {}) => single(make(IMAGE, 8), field, optional),
  sheet: (field = 'file') => single(make(SHEET, 5), field, false),
};
