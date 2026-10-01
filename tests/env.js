process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/signal_test';
process.env.JWT_SECRET = 'test-secret-0123456789abcdef';
process.env.S3_BUCKET = '';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'signal-test-uploads');
