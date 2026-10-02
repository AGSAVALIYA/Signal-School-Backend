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
  const expected = Buffer.from(sign(decodeURIComponent(key), exp));
  const given = Buffer.from(s);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const s3 = env.S3_BUCKET ? new S3Client({ region: env.AWS_REGION }) : null;
const localDir = path.resolve(env.UPLOAD_DIR);

// Photos are re-encoded: strips EXIF/location, fixes orientation, caps size for slow networks.
const toJpeg = (buffer, width = 1024) =>
  sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();

async function saveImage(buffer, folder) {
  const key = `${folder}/${crypto.randomUUID()}.jpg`;
  let body;
  try {
    body = await toJpeg(buffer);
  } catch {
    throw new AppError(400, 'FILE_TYPE'); // not a readable image, whatever its declared type
  }
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: 'image/jpeg' }));
  } else {
    const file = path.join(localDir, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }
  return key;
}

async function remove(key) {
  if (!key) return;
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  else await fs.rm(path.join(localDir, key), { force: true });
}

// Private files: signed URL on S3, local /files route in development.
async function urlFor(key) {
  if (!key) return null;
  if (s3) return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 2 * HOUR });
  // Expiry rounded to the hour so the same image keeps the same URL (browser cache) for a while.
  const exp = (Math.floor(Date.now() / 1000 / HOUR) + 3) * HOUR;
  return `${env.PUBLIC_API_URL || ''}/files/${key}?e=${exp}&s=${sign(key, exp)}`;
}

module.exports = { saveImage, remove, urlFor, verifySigned, localDir };
