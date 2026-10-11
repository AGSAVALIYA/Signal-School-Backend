// Password hashing with scrypt from Node's core: memory-hard (32 MiB per hash) and run on libuv's thread pool, so a
// morning burst of logins uses every CPU core and never stalls other requests (bcryptjs, used before, hashed on the
// main thread: 40 simultaneous logins took 4 s and froze the API meanwhile).
// Stored as scrypt$<log2 N>$<r>$<p>$<salt>$<key>. Older bcrypt hashes still verify and are upgraded at the next login.
const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');

const scrypt = promisify(crypto.scrypt);
const LOG_N = 15;
const R = 8;
const P = 1;
const PREFIX = `scrypt$${LOG_N}$${R}$${P}$`;
const maxmem = (logN, r) => 256 * r * 2 ** logN; // twice what scrypt needs

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(plain, salt, 32, { N: 2 ** LOG_N, r: R, p: P, maxmem: maxmem(LOG_N, R) });
  return `${PREFIX}${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(plain, stored = '') {
  if (stored.startsWith('scrypt$')) {
    const [, logN, r, p, salt, key] = stored.split('$');
    const expected = Buffer.from(key, 'base64url');
    const got = await scrypt(plain, Buffer.from(salt, 'base64url'), expected.length, {
      N: 2 ** Number(logN),
      r: Number(r),
      p: Number(p),
      maxmem: maxmem(Number(logN), Number(r)),
    });
    return crypto.timingSafeEqual(got, expected);
  }
  if (stored.startsWith('$2')) return bcrypt.compare(plain, stored);
  return false;
}

const needsRehash = (stored = '') => !stored.startsWith(PREFIX);

module.exports = { hashPassword, verifyPassword, needsRehash };
