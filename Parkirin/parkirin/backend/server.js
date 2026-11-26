// Parkirin (SmartPark Web) - Back-end REST API. Komunikasi dengan front-end melalui HTTP + JSON.
const os = require('os');
const express = require('express');
const QRCode = require('qrcode');
const store = require('./src/store');
const { hashPassword, verifyPassword, signToken, requireAuth } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {            // CORS sederhana (front-end dan back-end beda origin)
  res.set({ 'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- Health check (dipakai load balancer) ----------
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', instance: os.hostname(), uptimeSec: Math.round(process.uptime()), time: new Date().toISOString() }));

// ---------- Autentikasi ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || name.trim().length < 3) return bad(res, 'Nama lengkap minimal 3 karakter.');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) return bad(res, 'Format email tidak valid.');
  if (!/^08\d{8,12}$/.test(phone || '')) return bad(res, 'Nomor HP harus diawali 08 dan 10-14 digit.');
  if (!password || password.length < 8) return bad(res, 'Kata sandi minimal 8 karakter.');
  const lower = email.toLowerCase();
  if ([...store.users.values()].some((u) => u.email === lower)) return bad(res, 'Email sudah terdaftar.', 409);
  const id = store.nextUserId();
  const user = { id, name: name.trim(), email: lower, phone, passwordHash: hashPassword(password) };
  store.users.set(id, user);
  res.status(201).json({ message: 'Registrasi berhasil. Silakan masuk.', user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = [...store.users.values()].find((u) => u.email === String(email || '').toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) return bad(res, 'Email atau kata sandi salah.', 401);
  res.json({ token: signToken({ uid: user.id }), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const u = store.users.get(req.userId);
  u ? res.json(publicUser(u)) : bad(res, 'Pengguna tidak ditemukan.', 404);
});

// ---------- Lokasi & ringkasan dashboard ----------
const listLocations = () => [...store.locations.values()].map((l) => {
  const av = store.available(l);
  return { id: l.id, name: l.name, total: l.total, available: av, status: av > 0 ? 'Tersedia' : 'Penuh' };
});
app.get('/api/locations', requireAuth, (req, res) => res.json(listLocations()));

app.get('/api/dashboard', requireAuth, (req, res) => {
  const mine = [...store.bookings.values()].filter((b) => b.userId === req.userId);
  const active = mine.filter((b) => b.status === 'active');
  res.json({
    slotAvailable: listLocations().reduce((s, l) => s + l.available, 0),
    activeBookings: active.length,
    totalBookings: mine.length,
    activeTicket: active.sort((a, b) => b.id - a.id)[0] || null,
  });
});

// ---------- Booking (melibatkan User + Lokasi + Slot) ----------
app.post('/api/bookings', requireAuth, (req, res) => {
  const { locationId, plate, date, startTime, durationHours } = req.body || {};
  const loc = store.locations.get(Number(locationId));
  if (!loc) return bad(res, 'Lokasi parkir tidak ditemukan.', 404);
  if (!/^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/i.test(plate || '')) return bad(res, 'Format plat nomor tidak valid (contoh: R 1234 AB).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date < todayStr()) return bad(res, 'Tanggal tidak valid atau sudah lewat.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '')) return bad(res, 'Jam mulai tidak valid (HH:MM).');
  const dur = Number(durationHours);
  if (!Number.isInteger(dur) || dur < 1 || dur > 12) return bad(res, 'Durasi harus 1-12 jam.');
  const activeCount = [...store.bookings.values()].filter((b) => b.userId === req.userId && b.status === 'active').length;
  if (activeCount >= 3) return bad(res, 'Maksimal 3 booking aktif per pengguna.', 409);
  if (store.available(loc) <= 0) return bad(res, `${loc.name} sudah penuh.`, 409);
  const b = store.addBooking(req.userId, { locationId: loc.id, plate, date, startTime, durationHours: dur });
  res.status(201).json(b);
});

app.get('/api/bookings', requireAuth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const list = [...store.bookings.values()]
    .filter((b) => b.userId === req.userId)
    .filter((b) => !req.query.status || b.status === req.query.status)
    .filter((b) => !q || [b.code, b.locationName, b.plate].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => b.id - a.id);
  res.json(list);
});

function ownBooking(req, res) {
  const b = store.bookings.get(Number(req.params.id));
  if (!b || b.userId !== req.userId) { bad(res, 'Booking tidak ditemukan.', 404); return null; }
  return b;
}
app.get('/api/bookings/:id', requireAuth, (req, res) => { const b = ownBooking(req, res); if (b) res.json(b); });

app.get('/api/bookings/:id/qr', requireAuth, async (req, res) => {   // QR code tiket (SVG)
  const b = ownBooking(req, res); if (!b) return;
  const svg = await QRCode.toString(`${b.code}|${b.locationName}|SLOT-${b.slot}|${b.plate}`, { type: 'svg', margin: 1 });
  res.type('image/svg+xml').send(svg);
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {          // batalkan booking
  const b = ownBooking(req, res); if (!b) return;
  if (b.status !== 'active') return bad(res, 'Hanya booking aktif yang dapat dibatalkan.', 409);
  b.status = 'cancelled'; store.releaseSlot(b);
  res.json(b);
});
app.patch('/api/bookings/:id/finish', requireAuth, (req, res) => {    // selesai parkir
  const b = ownBooking(req, res); if (!b) return;
  if (b.status !== 'active') return bad(res, 'Booking ini tidak aktif.', 409);
  b.status = 'completed'; store.releaseSlot(b);
  res.json(b);
});

app.use('/api', (req, res) => bad(res, 'Endpoint tidak ditemukan.', 404));
app.use((err, req, res, next) => { console.error(err); bad(res, 'Terjadi kesalahan pada server.', 500); });

if (require.main === module) app.listen(PORT, '0.0.0.0', () => console.log(`Parkirin API berjalan di http://0.0.0.0:${PORT}`));
module.exports = app;
