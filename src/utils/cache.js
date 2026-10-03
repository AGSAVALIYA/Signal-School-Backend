// Optional Redis (REDIS_URL) for what must be shared between API instances: rate-limit counters and a small response
// cache. Without REDIS_URL everything stays in this process, which is right for the usual single small server.
//
// Response cache: entries are keyed by a per-school version that every successful write in that school increments, so a
// saved attendance sheet or new child shows up on the next read. CACHE_TTL (seconds) bounds anything else that can go
// stale (the date changing, a teacher renaming themself in another school). If Redis is unreachable the cache is
// skipped and the database answers, so Redis is never a single point of failure.
const env = require('../config/env');
const logger = require('./logger');
const { todayIn } = require('./dates');

let client = null;
if (env.REDIS_URL) {
  const { createClient } = require('redis');
  client = createClient({
    url: env.REDIS_URL,
    // Fail fast while disconnected instead of queueing commands (requests would hang).
    disableOfflineQueue: true,
    socket: { connectTimeout: 2000, reconnectStrategy: (retries) => Math.min(retries * 200, 5000) },
  });
  let warned = false;
  client.on('error', (err) => {
    if (!warned) logger.warn({ err: err.message }, 'redis unavailable; using the database without cache');
    warned = true;
  });
  client.on('ready', () => {
    warned = false;
    logger.info('redis connected');
  });
  client.connect().catch(() => {});
}

const redisReady = () => Boolean(client?.isReady);

// In-process fallback: a small map with expiry, oldest entries dropped first.
const MAX_LOCAL = 500;
const local = new Map();
const localVersions = new Map();
const localGet = (key) => {
  const hit = local.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    local.delete(key);
    return null;
  }
  return hit.value;
};
const localSet = (key, value, ttl) => {
  if (local.size >= MAX_LOCAL) local.delete(local.keys().next().value);
  local.set(key, { value, exp: Date.now() + ttl * 1000 });
};

const enabled = () => env.CACHE_TTL > 0 && (!client || redisReady());

async function version(schoolId) {
  if (client) return (await client.get(`ss:v:${schoolId}`)) || '0';
  return localVersions.get(schoolId) || 0;
}

// Called after every successful write in a school: makes all its cached responses obsolete.
async function bump(schoolId) {
  localVersions.set(schoolId, (localVersions.get(schoolId) || 0) + 1);
  if (redisReady()) await client.incr(`ss:v:${schoolId}`);
}

// Route middleware (after yearScope): answers from the cache for this school, year, school-local date and route, or
// lets the handler run and stores its JSON. `perUser` for answers that depend on who asks. Any cache error just
// means the database answers.
const cacheResponse =
  (name, { perUser = false } = {}) =>
  async (req, res, next) => {
    if (!enabled()) return next();
    let key;
    try {
      const parts = [req.school.id, await version(req.school.id), req.year?.id ?? '-', todayIn(req.school.timezone), name, req.originalUrl];
      key = ['ss:c', ...parts, perUser ? req.user.id : '-'].join(':');
      const hit = client ? await client.get(key) : localGet(key);
      if (hit) return res.set('X-Cache', 'HIT').type('json').send(hit);
    } catch (err) {
      logger.warn({ err: err.message }, 'cache read failed');
      return next();
    }
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        const text = JSON.stringify(body);
        if (client) client.set(key, text, { EX: env.CACHE_TTL }).catch(() => {});
        else localSet(key, text, env.CACHE_TTL);
      }
      res.set('X-Cache', 'MISS');
      return json(body);
    };
    next();
  };

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Middleware (after schoolScope): a successful write invalidates the school's cache before the response leaves, so the
// client's refetch right after a save can never see the old answer.
function invalidateOnWrite(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const end = res.end.bind(res);
  res.end = (...args) => {
    if (res.statusCode >= 400) return end(...args);
    bump(req.school.id)
      .catch((err) => logger.warn({ err: err.message }, 'cache invalidation failed'))
      .finally(() => end(...args));
    return res;
  };
  next();
}

// Shared rate-limit counters when several API instances run behind one proxy (fixed window: INCR + PEXPIRE NX).
// While Redis is unreachable the calls fail fast and the limiter lets requests through (passOnStoreError).
class RedisRateStore {
  localKeys = false;

  constructor(prefix) {
    this.prefix = `ss:rl:${prefix}:`;
  }

  init({ windowMs }) {
    this.windowMs = windowMs;
  }

  async increment(key) {
    if (!redisReady()) throw new Error('redis not ready'); // commands would wait for the next reconnect attempt
    const k = this.prefix + key;
    const [hits, , ttl] = await client
      .multi()
      .addCommand(['INCR', k])
      .addCommand(['PEXPIRE', k, String(this.windowMs), 'NX'])
      .addCommand(['PTTL', k])
      .exec();
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(Number(ttl), 0)) };
  }

  async decrement(key) {
    if (redisReady()) await client.decr(this.prefix + key);
  }

  async resetKey(key) {
    if (redisReady()) await client.del(this.prefix + key);
  }
}

const rateLimitStore = (prefix) => (client ? new RedisRateStore(prefix) : undefined);

async function ping() {
  if (!client) return 'off';
  if (!redisReady()) return 'down';
  try {
    return (await client.ping()) === 'PONG' ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

// Drops every cached response and version (tests; after restoring a database backup).
async function clear() {
  local.clear();
  localVersions.clear();
  if (!redisReady()) return;
  for await (const keys of client.scanIterator({ MATCH: 'ss:*', COUNT: 500 })) if (keys.length) await client.del(keys);
}

const close = () => (client?.isOpen ? client.quit().catch(() => {}) : undefined);

module.exports = { cacheResponse, invalidateOnWrite, bump, rateLimitStore, ping, clear, close, redisReady };
