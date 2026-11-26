// Autentikasi stateless: password di-hash (scrypt), token bertanda tangan HMAC (mirip JWT).
// Karena stateless, request dapat dilayani instance back-end mana pun di belakang load balancer.
const crypto = require('crypto');
const SECRET = process.env.TOKEN_SECRET || 'parkirin-dev-secret-ganti-di-produksi';

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sign(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function signToken(payload, ttlSec = 8 * 3600) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString('base64url');
  return `${body}.${sign(body)}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() / 1000 ? p : null;
}
// Middleware: wajib login
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const p = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!p) return res.status(401).json({ error: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
  req.userId = p.uid;
  next();
}
module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAuth };
