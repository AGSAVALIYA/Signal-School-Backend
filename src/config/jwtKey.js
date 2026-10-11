const crypto = require('crypto');
const env = require('./env');

// Access tokens are signed and checked with a key object made once (jsonwebtoken converts a string secret on every
// call, first trying it as a public key: a thrown error per request).
module.exports = crypto.createSecretKey(Buffer.from(env.JWT_SECRET));
