/* Parkirin front-end (SPA sederhana, vanilla JS). Berkomunikasi dengan back-end lewat HTTP + JSON. */
const API = (window.PARKIRIN_API || '').replace(/\/$/, '');
const $app = document.getElementById('app');
const state = { token: localStorage.getItem('pk_token'), user: JSON.parse(localStorage.getItem('pk_user') || 'null') };

/* ---------- Util ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const endTime = (start, h) => { const [H, M] = start.split(':').map(Number); return String((H + h) % 24).padStart(2, '0') + ':' + String(M).padStart(2, '0'); };
const ico = {
  grid: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  list: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
};
const logo = '<span class="logo"><span class="logo-mark">P</span>Parkirin</span>';
const badge = (s) => ({ active: '<span class="badge b-active">Aktif</span>', completed: '<span class="badge b-done">Selesai</span>', cancelled: '<span class="badge b-cancel">Dibatalkan</span>' }[s]);

let toastTimer;
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), 3000);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) };
  let res;
  try { res = await fetch(API + path, { ...opts, headers }); }
  catch { throw new Error('Tidak dapat terhubung ke server. Periksa koneksi atau alamat API.'); }
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json() : await res.text();
  if (res.status === 401 && state.token) { logout(); throw new Error(body.error || 'Sesi berakhir.'); }
  if (!res.ok) throw new Error(body.error || 'Terjadi kesalahan.');
  return body;
}
function logout() {
  state.token = null; state.user = null; localStorage.removeItem('pk_token'); localStorage.removeItem('pk_user'); location.hash = '#/login';
}
async function loadQR(id, imgEl) {            // QR code berupa SVG dari endpoint back-end (perlu token)
  try {
    const res = await fetch(`${API}/api/bookings/${id}/qr`, { headers: { Authorization: 'Bearer ' + state.token } });
    imgEl.src = URL.createObjectURL(await res.blob());
  } catch { imgEl.alt = 'QR gagal dimuat'; }
}

/* ---------- Layout ---------- */
function shell(active, html) {
  const initial = (state.user?.name || '?').trim()[0].toUpperCase();
  const link = (h, label) => `<a href="#/${h}" class="${active === h ? 'active' : ''}">${label}</a>`;
  $app.innerHTML = `
    <header class="navbar"><div class="container">
      <a href="#/dashboard" style="text-decoration:none">${logo}</a>
      <nav class="nav-links">${link('dashboard', 'Beranda')}${link('booking', 'Booking')}${link('tickets', 'Tiket Aktif')}${link('history', 'Riwayat')}</nav>
      <div class="user-chip"><span class="avatar">${esc(initial)}</span><span class="name small">${esc(state.user?.name || '')}</span>
        <button class="btn btn-outline btn-sm" id="btn-logout">Keluar</button></div>
    </div></header>
    <main class="container">${html}</main>
    <footer class="footer">Parkirin &middot; &copy; 2026 SmartPark Web</footer>`;
  document.getElementById('btn-logout').onclick = logout;
}
const loading = '<div class="empty"><span class="spinner"></span><p>Memuat data...</p></div>';

/* ---------- Halaman Auth ---------- */
function authLayout(inner) {
  $app.innerHTML = `<div class="auth">
    <section class="auth-brand"><div>${logo}<h1>Parkir tanpa antre,<br>pesan dari mana saja.</h1>
      <p>Reservasi slot parkir, dapatkan tiket QR, dan masuk area parkir dengan cepat.</p>
      <ul class="perks"><li><span class="dot">&#10003;</span>Cek ketersediaan slot secara langsung</li>
        <li><span class="dot">&#10003;</span>Booking slot dalam hitungan detik</li>
        <li><span class="dot">&#10003;</span>Tiket QR siap dipindai di gerbang</li></ul></div>
      <span class="small" style="color:#BFDBFE">&copy; 2026 Parkirin - SmartPark Web</span></section>
    <section class="auth-form-wrap"><div class="auth-card">${inner}</div></section></div>`;
}
const field = (id, label, type, ph, extra = '') =>
  `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="${type}" placeholder="${ph}" ${extra}><div class="err" id="err-${id}"></div></div>`;

function renderLogin() {
  authLayout(`<h2>Masuk ke Akun</h2><p class="muted" style="margin:0 0 22px">Silakan masuk untuk memesan slot parkir</p>
    <div id="msg"></div>
    ${field('email', 'Email', 'email', 'nama@email.com', 'autocomplete="username"')}
    ${field('password', 'Kata Sandi', 'password', '********', 'autocomplete="current-password"')}
    <div class="row between" style="margin-bottom:18px"><label class="small row" style="gap:8px"><input type="checkbox" id="remember"> Ingat saya</label><a href="#/login" class="small">Lupa kata sandi?</a></div>
    <button class="btn btn-primary btn-block" id="submit">Masuk</button>
    <p class="muted small" style="text-align:center;margin-top:20px">Belum punya akun? <a href="#/register">Daftar</a></p>`);
  const btn = document.getElementById('submit');
  btn.onclick = async () => {
    const email = val('email'), password = val('password');
    if (!email || !password) return showMsg('Email dan kata sandi wajib diisi.', true);
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      state.token = r.token; state.user = r.user;
      localStorage.setItem('pk_token', r.token); localStorage.setItem('pk_user', JSON.stringify(r.user));
      location.hash = '#/dashboard';
    } catch (e) { showMsg(e.message, true); btn.disabled = false; btn.textContent = 'Masuk'; }
  };
  document.getElementById('password').addEventListener('keydown', (e) => e.key === 'Enter' && btn.click());
}

function renderRegister() {
  authLayout(`<h2>Buat Akun Baru</h2><p class="muted" style="margin:0 0 22px">Daftar untuk mulai memesan slot parkir</p>
    <div id="msg"></div>
    ${field('name', 'Nama Lengkap', 'text', 'Masukkan nama lengkap')}
    ${field('email', 'Email', 'email', 'nama@email.com')}
    ${field('phone', 'Nomor HP', 'tel', '08xxxxxxxxxx')}
    <div class="grid2">${field('password', 'Kata Sandi', 'password', '********')}${field('confirm', 'Konfirmasi Kata Sandi', 'password', '********')}</div>
    <button class="btn btn-primary btn-block" id="submit">Daftar</button>
    <p class="muted small" style="text-align:center;margin-top:20px">Sudah punya akun? <a href="#/login">Masuk</a></p>`);
  const btn = document.getElementById('submit');
  btn.onclick = async () => {
    const d = { name: val('name'), email: val('email'), phone: val('phone'), password: val('password') };
    clearErrors();
    let ok = true;
    if (d.name.length < 3) ok = fieldErr('name', 'Nama minimal 3 karakter.');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) ok = fieldErr('email', 'Format email tidak valid.');
    if (!/^08\d{8,12}$/.test(d.phone)) ok = fieldErr('phone', 'Gunakan format 08xxxxxxxxxx.');
    if (d.password.length < 8) ok = fieldErr('password', 'Minimal 8 karakter.');
    if (d.password !== val('confirm')) ok = fieldErr('confirm', 'Konfirmasi tidak sama.');
    if (!ok) return;
    btn.disabled = true; btn.textContent = 'Memproses...';
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(d) });
      location.hash = '#/login'; setTimeout(() => toast('Registrasi berhasil. Silakan masuk.'), 100);
    } catch (e) { showMsg(e.message, true); btn.disabled = false; btn.textContent = 'Daftar'; }
  };
}
const val = (id) => document.getElementById(id).value.trim();
const showMsg = (m, err) => (document.getElementById('msg').innerHTML = `<div class="alert ${err ? 'alert-error' : 'alert-ok'}">${esc(m)}</div>`);
const clearErrors = () => document.querySelectorAll('.err').forEach((e) => (e.textContent = '')) || document.querySelectorAll('.input').forEach((i) => i.classList.remove('invalid'));
function fieldErr(id, m) { document.getElementById('err-' + id).textContent = m; document.getElementById(id).classList.add('invalid'); return false; }

/* ---------- Dashboard ---------- */
async function renderDashboard() {
  shell('dashboard', loading);
  try {
    const [sum, locs] = await Promise.all([api('/api/dashboard'), api('/api/locations')]);
    const t = sum.activeTicket;
    const rows = (q = '') => locs.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).map((l) => `
      <tr><td><b>${esc(l.name)}</b></td><td>${l.available} <span class="muted small">/ ${l.total}</span></td>
      <td><span class="badge ${l.available ? 'b-ok' : 'b-full'}">${l.status}</span></td>
      <td>${l.available ? `<a class="btn btn-primary btn-sm" href="#/booking?loc=${l.id}" style="text-decoration:none">Pesan</a>` : '<span class="muted">-</span>'}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty">Lokasi tidak ditemukan.</td></tr>';
    shell('dashboard', `
      <h1>Selamat Datang, ${esc(state.user.name)}</h1><p class="muted" style="margin:4px 0 0">Ringkasan aktivitas parkir Anda</p>
      <section class="stats">
        <div class="card stat"><span class="ico blue">${ico.grid}</span><div><div class="muted small">Slot Tersedia</div><div class="num">${sum.slotAvailable}</div></div></div>
        <div class="card stat"><span class="ico amber">${ico.clock}</span><div><div class="muted small">Booking Aktif</div><div class="num">${sum.activeBookings}</div></div></div>
        <div class="card stat"><span class="ico green">${ico.list}</span><div><div class="muted small">Total Booking</div><div class="num">${sum.totalBookings}</div></div></div>
      </section>
      <div class="layout">
        <section class="card"><div class="toolbar"><h2>Daftar Lokasi Parkir</h2>
          <div class="search">${ico.search}<input class="input" id="q" placeholder="Cari lokasi..." style="width:200px"></div></div>
          <div class="table-wrap"><table><thead><tr><th>Lokasi</th><th>Slot Kosong</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="rows">${rows()}</tbody></table></div>
          <p style="margin:18px 0 0"><a class="btn btn-primary" href="#/booking" style="text-decoration:none">+ Booking Baru</a></p></section>
        <section class="card ticket"><h2 style="text-align:left">Tiket Aktif</h2>
          ${t ? `<div class="qr"><img id="qr" alt="QR tiket"></div><div class="code">Kode: ${esc(t.code)}</div>
            <p class="muted" style="margin:2px 0 14px">${esc(t.locationName)} - Slot ${String(t.slot).padStart(2, '0')}</p>
            <a class="btn btn-outline btn-sm" href="#/tickets" style="text-decoration:none">Lihat Tiket</a>`
          : '<div class="empty">Belum ada tiket aktif.<br>Buat booking untuk mendapatkan tiket.</div>'}</section>
      </div>`);
    document.getElementById('q').oninput = (e) => (document.getElementById('rows').innerHTML = rows(e.target.value));
    if (t) loadQR(t.id, document.getElementById('qr'));
  } catch (e) { shell('dashboard', `<div class="alert alert-error">${esc(e.message)}</div>`); }
}

/* ---------- Booking ---------- */
async function renderBooking(params) {
  shell('booking', loading);
  try {
    const locs = await api('/api/locations');
    let sel = Number(params.get('loc')) || (locs.find((l) => l.available) || {}).id;
    const today = new Date().toISOString().slice(0, 10);
    shell('booking', `
      <h1>Booking Baru</h1><p class="muted" style="margin:4px 0 20px">Pilih lokasi dan isi detail kendaraan Anda</p>
      <div class="layout"><section class="card"><div id="msg"></div>
        <div class="field"><label>Lokasi Parkir</label><div class="loc-options" id="locs"></div></div>
        <div class="grid2">${field('plate', 'Plat Nomor', 'text', 'R 1234 AB')}<div class="field"><label for="duration">Durasi</label>
          <select class="input" id="duration">${[1, 2, 3, 4, 6, 8, 12].map((h) => `<option value="${h}" ${h === 3 ? 'selected' : ''}>${h} jam</option>`).join('')}</select></div></div>
        <div class="grid2">${field('date', 'Tanggal', 'date', '', `value="${today}" min="${today}"`)}${field('time', 'Jam Mulai', 'time', '', 'value="09:00"')}</div>
        <button class="btn btn-primary" id="submit">Konfirmasi Booking</button></section>
        <aside class="card"><h2 style="margin-bottom:10px">Ringkasan</h2><div id="sum"></div></aside></div>`);
    const draw = () => {
      document.getElementById('locs').innerHTML = locs.map((l) => `<button type="button" class="loc-opt ${l.id === sel ? 'sel' : ''} ${l.available ? '' : 'full'}" data-id="${l.id}" ${l.available ? '' : 'disabled'}>
        <b>${esc(l.name)}</b><span class="small ${l.available ? 'muted' : ''}">${l.available ? l.available + ' slot kosong' : 'Penuh'}</span></button>`).join('');
      document.querySelectorAll('.loc-opt').forEach((b) => (b.onclick = () => { sel = Number(b.dataset.id); draw(); sumUp(); }));
    };
    const sumUp = () => {
      const l = locs.find((x) => x.id === sel), d = Number(document.getElementById('duration').value), st = val('time');
      const row = (k, v) => `<div class="summary-row"><span class="muted">${k}</span><b>${esc(v)}</b></div>`;
      document.getElementById('sum').innerHTML = row('Lokasi', l ? l.name : '-') + row('Plat', val('plate') || '-') + row('Tanggal', val('date') ? fmtDate(val('date')) : '-')
        + row('Waktu', st ? `${st} - ${endTime(st, d)}` : '-') + row('Durasi', d + ' jam') + row('Status slot', l ? l.status : '-');
    };
    draw(); sumUp();
    ['plate', 'date', 'time', 'duration'].forEach((id) => document.getElementById(id).addEventListener('input', sumUp));
    const btn = document.getElementById('submit');
    btn.onclick = async () => {
      clearErrors();
      if (!/^[A-Za-z]{1,2}\s?\d{1,4}\s?[A-Za-z]{0,3}$/.test(val('plate'))) return fieldErr('plate', 'Format plat tidak valid (contoh: R 1234 AB).');
      btn.disabled = true; btn.textContent = 'Memproses...';
      try {
        await api('/api/bookings', { method: 'POST', body: JSON.stringify({ locationId: sel, plate: val('plate'), date: val('date'), startTime: val('time'), durationHours: Number(val('duration')) }) });
        location.hash = '#/tickets'; setTimeout(() => toast('Booking berhasil! Tiket Anda sudah aktif.'), 100);
      } catch (e) { showMsg(e.message, true); btn.disabled = false; btn.textContent = 'Konfirmasi Booking'; }
    };
  } catch (e) { shell('booking', `<div class="alert alert-error">${esc(e.message)}</div>`); }
}

/* ---------- Tiket aktif ---------- */
async function renderTickets() {
  shell('tickets', loading);
  try {
    const list = await api('/api/bookings?status=active');
    shell('tickets', `<h1>Tiket Aktif</h1><p class="muted" style="margin:4px 0 20px">Tunjukkan QR code di gerbang parkir</p>
      ${list.length ? `<div class="tickets-grid">${list.map((b) => `
        <article class="card ticket"><div class="row between"><span class="badge b-active">Aktif</span><span class="muted small">${esc(b.locationName)}</span></div>
          <div class="qr"><img data-id="${b.id}" alt="QR ${esc(b.code)}"></div><div class="code">${esc(b.code)}</div>
          <div class="ticket-meta"><div><span class="muted">Slot</span><b>${String(b.slot).padStart(2, '0')}</b></div><div><span class="muted">Plat</span><b>${esc(b.plate)}</b></div>
            <div><span class="muted">Tanggal</span><b>${fmtDate(b.date)}</b></div><div><span class="muted">Waktu</span><b>${b.startTime} - ${endTime(b.startTime, b.durationHours)}</b></div></div>
          <div class="grid2"><button class="btn btn-primary btn-sm" data-finish="${b.id}">Selesai Parkir</button><button class="btn btn-danger btn-sm" data-cancel="${b.id}">Batalkan</button></div></article>`).join('')}</div>`
      : '<div class="card empty">Belum ada tiket aktif. <a href="#/booking">Buat booking baru</a></div>'}`);
    document.querySelectorAll('img[data-id]').forEach((i) => loadQR(i.dataset.id, i));
    const act = (attr, method, path, msg) => document.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = async () => {
      if (method === 'DELETE' && !confirm('Batalkan booking ini?')) return;
      try { await api(`/api/bookings/${b.getAttribute(attr)}${path}`, { method }); toast(msg); renderTickets(); } catch (e) { toast(e.message, true); }
    }));
    act('data-cancel', 'DELETE', '', 'Booking dibatalkan.'); act('data-finish', 'PATCH', '/finish', 'Parkir selesai. Terima kasih!');
  } catch (e) { shell('tickets', `<div class="alert alert-error">${esc(e.message)}</div>`); }
}

/* ---------- Riwayat ---------- */
async function renderHistory() {
  shell('history', loading);
  try {
    const draw = async () => {
      const q = encodeURIComponent(document.getElementById('q').value), s = document.getElementById('status').value;
      const list = await api(`/api/bookings?q=${q}&status=${s}`);
      document.getElementById('rows').innerHTML = list.map((b) => `<tr><td><b>${esc(b.code)}</b></td><td>${esc(b.locationName)} - Slot ${String(b.slot).padStart(2, '0')}</td><td>${esc(b.plate)}</td>
        <td>${fmtDate(b.date)}<br><span class="muted small">${b.startTime} - ${endTime(b.startTime, b.durationHours)}</span></td><td>${badge(b.status)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="empty">Tidak ada riwayat booking.</td></tr>';
    };
    shell('history', `<h1>Riwayat Booking</h1><p class="muted" style="margin:4px 0 20px">Seluruh booking parkir Anda</p>
      <section class="card"><div class="toolbar"><div class="search">${ico.search}<input class="input" id="q" placeholder="Cari kode, lokasi, atau plat..." style="width:300px"></div>
        <select class="input" id="status" style="width:180px"><option value="">Semua status</option><option value="active">Aktif</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></div>
        <div class="table-wrap"><table><thead><tr><th>Kode</th><th>Lokasi</th><th>Plat</th><th>Jadwal</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div></section>`);
    document.getElementById('q').oninput = draw; document.getElementById('status').onchange = draw; await draw();
  } catch (e) { shell('history', `<div class="alert alert-error">${esc(e.message)}</div>`); }
}

/* ---------- Router (hash) ---------- */
function router() {
  const [path, qs] = (location.hash.slice(1) || '/dashboard').split('?');
  const params = new URLSearchParams(qs || '');
  const publicRoutes = { '/login': renderLogin, '/register': renderRegister };
  const privateRoutes = { '/dashboard': renderDashboard, '/booking': () => renderBooking(params), '/tickets': renderTickets, '/history': renderHistory };
  if (publicRoutes[path]) return state.token ? (location.hash = '#/dashboard') : publicRoutes[path]();
  if (!state.token) return (location.hash = '#/login');
  (privateRoutes[path] || renderDashboard)();
}
window.addEventListener('hashchange', router);
router();
