const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

const s3 = env.S3_BUCKET ? new S3Client({ region: env.AWS_REGION }) : null;
const localDir = path.resolve(env.UPLOAD_DIR);

// Photos are re-encoded: strips EXIF/location, fixes orientation, caps size for slow networks.
const toJpeg = (buffer, width = 1024) =>
  sharp(buffer).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();

async function saveImage(buffer, folder) {
  const key = `${folder}/${crypto.randomUUID()}.jpg`;
  const body = await toJpeg(buffer);
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
  if (!key || /^https?:\/\//.test(key)) return;
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  else await fs.rm(path.join(localDir, key), { force: true });
}

// Private files: signed URL on S3, local /files route in development.
async function urlFor(key) {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key; // legacy rows stored full public URLs
  if (s3) return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 3600 });
  return `/files/${key}`;
}

module.exports = { saveImage, remove, urlFor, localDir };
