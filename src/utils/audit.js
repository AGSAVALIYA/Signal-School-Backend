const { AuditLog } = require('../db/models');
const logger = require('./logger');

// Audit never breaks the main action: failures are logged, not thrown.
async function audit(req, action, { entityType, entityId, summary, before, after } = {}, transaction) {
  try {
    await AuditLog.create(
      {
        schoolId: req.school?.id ?? null,
        userId: req.user?.id ?? null,
        action,
        entityType,
        entityId,
        summary,
        before: before ?? null,
        after: after ?? null,
        ip: req.ip,
        requestId: req.id,
      },
      { transaction },
    );
  } catch (err) {
    logger.error({ err, action }, 'audit write failed');
  }
}

module.exports = audit;
