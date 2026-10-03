const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const { AppError } = require('./errors');

// Local file links carry an HMAC signature with an expiry, so a leaked or guessed path is useless.
const fileKey = crypto.createHmac('sha256', env.JWT_SECRET).update('local-files').digest();
const sign = (key, exp) => crypto.createHmac('sha256', fileKey).update(`${key}|${exp}`).digest('base64url');
const HOUR = 3600;

function verifySigned(key, { e, s } = {}) {
  const exp = Number(e);
  if (!key || key.includes('..') || !exp || exp < Date.now() / 1000 || typeof s !== 'string') return false;
  let decoded;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    return false;
  }
  const expected = Buffer.from(sign(decoded, exp));
  const given = Buffer.from(s);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const s3 = env.S3_BUCKET ? new S3Client({ region: env.AWS_REGION }) : null;
const localDir = path.resolve(env.UPLOAD_DIR);

// Photos are re-encoded: strips EXIF/location, fixes orientation, caps size for slow networks.
const toJpeg = (buffer, width = 1024, quality = 78) =>
  sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

// Avatars in lists are 40 px; 160 px stays sharp on 3x phone screens at ~5–10 KB instead of ~150 KB.
const THUMB = 160;
const thumbKey = (key) => key.replace(/\.jpg$/, '.thumb.jpg');
const makeThumb = (buffer) =>
  sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: THUMB, height: THUMB, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();

async function put(key, body) {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: 'image/jpeg' }));
  } else {
    const file = path.join(localDir, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }
}

async function get(key) {
  if (!s3) return fs.readFile(path.join(localDir, key));
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

// `thumb: true` also stores a square thumbnail next to the photo (same key + `.thumb.jpg`).
async function saveImage(buffer, folder, { thumb = false } = {}) {
  const key = `${folder}/${crypto.randomUUID()}.jpg`;
  let body;
  try {
    body = await toJpeg(buffer);
  } catch {
    throw new AppError(400, 'FILE_TYPE'); // not a readable image, whatever its declared type
  }
  await Promise.all([put(key, body), thumb && put(thumbKey(key), await makeThumb(body))]);
  return key;
}

// Creates a missing thumbnail for an existing photo (used by scripts/make-thumbnails.js).
async function ensureThumb(key) {
  await put(thumbKey(key), await makeThumb(await get(key)));
}

async function remove(key) {
  if (!key) return;
  const keys = key.endsWith('.thumb.jpg') ? [key] : [key, thumbKey(key)];
  if (s3) await Promise.all(keys.map((k) => s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: k }))));
  else await Promise.all(keys.map((k) => fs.rm(path.join(localDir, k), { force: true })));
}

// Private files: signed URL on S3, local /files route in development.
async function urlFor(key) {
  if (!key) return null;
  if (s3) return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 2 * HOUR });
  // Expiry rounded to the hour so the same image keeps the same URL (browser cache) for a while.
  const exp = (Math.floor(Date.now() / 1000 / HOUR) + 3) * HOUR;
  return `${env.PUBLIC_API_URL || ''}/files/${key}?e=${exp}&s=${sign(key, exp)}`;
}

const thumbUrlFor = (key) => urlFor(key && thumbKey(key));

module.exports = { saveImage, ensureThumb, remove, urlFor, thumbUrlFor, thumbKey, verifySigned, localDir };
