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
  // Public base URL of this API (e.g. https://api.example.org) when the web app runs on another origin; used for local file links.
  PUBLIC_API_URL: z.string().url().optional().or(z.literal('')),
  S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  UPLOAD_DIR: z.string().default('uploads'),
  LOG_LEVEL: z.string().default('info'),
  // Logins per IP per 15 minutes. Raise only for local end-to-end test runs (many logins from one machine).
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  // Requests per IP per minute across the API (raise for load tests only).
  API_RATE_LIMIT: z.coerce.number().int().positive().default(600),
  // Optional: share rate limits and cached responses between API instances (redis://host:6379).
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  // Seconds a cached read (dashboard, class list, …) may live; writes in the school invalidate it at once. 0 disables.
  CACHE_TTL: z.coerce
    .number()
    .int()
    .min(0)
    .default(process.env.NODE_ENV === 'test' ? 0 : 60),
});

const parsed = schema
  .refine((e) => e.NODE_ENV !== 'production' || e.JWT_SECRET.length >= 32, { path: ['JWT_SECRET'], message: 'must be at least 32 characters in production' })
  .refine((e) => e.NODE_ENV !== 'production' || !/change-me/.test(e.JWT_SECRET), { path: ['JWT_SECRET'], message: 'replace the example value' })
  .safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
  process.exit(1);
}

module.exports = parsed.data;
