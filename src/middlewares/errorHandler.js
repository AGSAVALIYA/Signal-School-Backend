const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError, DatabaseError } = require('sequelize');
const { AppError, MESSAGES } = require('../utils/errors');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  let e = err;
  if (err instanceof UniqueConstraintError) e = new AppError(409, 'DUPLICATE');
  else if (err instanceof ForeignKeyConstraintError) e = new AppError(409, 'IN_USE');
  else if (err instanceof ValidationError) e = new AppError(400, 'VALIDATION');
  else if (err instanceof DatabaseError && err.parent?.code === '22P02') e = new AppError(400, 'VALIDATION');
  else if (err.type === 'entity.parse.failed') e = new AppError(400, 'VALIDATION');

  if (!(e instanceof AppError)) {
    logger.error({ err, requestId: req.id, path: req.path }, 'unhandled error');
    e = new AppError(500, 'INTERNAL');
  }
  res.status(e.status).json({
    error: { code: e.code, message: MESSAGES[e.code] || e.message, params: e.params, fields: e.fields, requestId: req.id },
  });
};
