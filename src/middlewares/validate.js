const { badRequest } = require('../utils/errors');

// Validates req[part] with a zod schema; parsed values land on req.v[part] (Express 5 req.query is read-only).
const validate = (schemas) =>
  function validateRequest(req, _res, next) {
    req.v = req.v || {};
    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const fields = {};
        for (const issue of result.error.issues) fields[issue.path.join('.') || part] = issue.code.toUpperCase();
        throw badRequest('VALIDATION', { fields });
      }
      req.v[part] = result.data;
    }
    next();
  };

module.exports = validate;
