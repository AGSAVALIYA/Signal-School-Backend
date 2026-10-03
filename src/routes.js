const router = require('express').Router();
const { authenticate, schoolScope } = require('./middlewares/auth');
const { invalidateOnWrite } = require('./utils/cache');

// Public + self routes (no school context needed).
router.use(require('./modules/auth/auth.routes'));

// Everything below runs as an authenticated member of one school.
router.use(authenticate, schoolScope, invalidateOnWrite);
for (const mod of ['schools', 'users', 'structure', 'years', 'students', 'attendance', 'diary', 'syllabus', 'marks', 'health', 'dashboard']) {
  router.use(require(`./modules/${mod}/${mod}.routes`));
}

module.exports = router;
