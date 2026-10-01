require('dotenv').config({ quiet: true });
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_CA: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  UPLOAD_DIR: z.string().default('uploads'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
  process.exit(1);
}

module.exports = parsed.data;
