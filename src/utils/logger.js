const pino = require('pino');
const env = require('../config/env');

module.exports = pino({ level: env.NODE_ENV === 'test' && !process.env.TEST_LOG ? 'silent' : env.LOG_LEVEL });
