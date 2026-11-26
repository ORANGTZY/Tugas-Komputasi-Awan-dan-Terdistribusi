// Data disimpan di memori (objek JavaScript) - sesuai ketentuan tanpa database/storage tambahan.
// Data kembali ke kondisi awal (seed) setiap server di-restart.
const { hashPassword } = require('./auth');

const users = new Map();
const locations = new Map();
const bookings = new Map();
let seq = { user: 0, booking: 0 };

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function initLocation(id, name, total, takenSlots) {
  locations.set(id, { id, name, total, taken: new Set(takenSlots) });
}

function available(loc) { return loc.total - loc.taken.size; }
function pickSlot(loc, preferred) {
  if (preferred && !loc.taken.has(preferred)) return preferred;
  for (let n = 1; n <= loc.total; n++) if (!loc.taken.has(n)) return n;
  return null;
}
function addBooking(userId, data, status = 'active', forceSlot) {
  const loc = locations.get(data.locationId);
  const slot = status === 'active' ? pickSlot(loc, forceSlot) : (forceSlot || 1);
  if (slot === null) return null;
  if (status === 'active') loc.taken.add(slot);
  const id = ++seq.booking;
  const b = {
    id, code: 'PK-' + String(id).padStart(4, '0'), userId, locationId: loc.id, locationName: loc.name,
    slot, plate: data.plate.toUpperCase(), date: data.date, startTime: data.startTime,
    durationHours: data.durationHours, status, createdAt: new Date().toISOString(),
  };
  bookings.set(id, b);
  return b;
}
function releaseSlot(b) { const loc = locations.get(b.locationId); if (loc) loc.taken.delete(b.slot); }

function seed() {
  users.clear(); locations.clear(); bookings.clear(); seq = { user: 0, booking: 0 };
  // Lokasi parkir: total slot dan slot yang sudah terisi
  initLocation(1, 'Gedung A', 20, [1, 2, 3, 4, 5]);   // 15 kosong sebelum booking demo -> 14
  initLocation(2, 'Gedung B', 12, [1, 2]);            // 10 kosong
  initLocation(3, 'Gedung C', 10, range(1, 10));      // penuh
  // Pengguna demo (email: demo@parkirin.id, sandi: Demo1234)
  const uid = ++seq.user;
  users.set(uid, { id: uid, name: 'Budi Santoso', email: 'demo@parkirin.id', phone: '081234567890',
                   passwordHash: hashPassword('Demo1234') });
  // 11 booking selesai + 1 booking aktif (Gedung A - Slot 07) = total 12
  for (let i = 0; i < 11; i++) {
    const d = new Date(Date.now() - (i + 1) * 3 * 864e5).toISOString().slice(0, 10);
    addBooking(uid, { locationId: i % 3 === 0 ? 2 : 1, plate: 'R 1234 AB', date: d,
                      startTime: i % 2 ? '13:00' : '08:00', durationHours: 2 + (i % 4) }, 'completed', 3 + i);
  }
  addBooking(uid, { locationId: 1, plate: 'R 1234 AB', date: new Date().toISOString().slice(0, 10),
                    startTime: '09:00', durationHours: 3 }, 'active', 7);
}

seed();
module.exports = { users, locations, bookings, available, addBooking, releaseSlot, nextUserId: () => ++seq.user, seed };
