# Parkirin (SmartPark Web)

Sistem reservasi parkir berbasis web - tugas Komputasi Awan dan Terdistribusi (Telkom University).

```
frontend/   HTML + CSS + JavaScript (SPA, statis)    -> disajikan Nginx / static host
backend/    Node.js + Express (REST API, HTTP+JSON)  -> port 3000
scripts/    deploy.sh (pasang di EC2), monitor.sh (cek kondisi server)
```
Data disimpan di memori (objek JavaScript, tanpa database) dan kembali ke data awal saat server restart.

## Menjalankan lokal
```bash
cd backend && npm install && npm start          # http://localhost:3000
cd frontend && python3 -m http.server 8080      # http://localhost:8080
```
Akun demo: `demo@parkirin.id` / `Demo1234`. Alamat API diatur di `frontend/config.js`.

## Endpoint utama
| Method | Path | Keterangan |
|---|---|---|
| GET | /api/health | health check (dipakai load balancer) |
| POST | /api/auth/register, /api/auth/login | daftar dan masuk (token bertanda tangan) |
| GET | /api/locations, /api/dashboard | lokasi parkir dan ringkasan |
| POST/GET | /api/bookings | buat booking, riwayat (filter `q`, `status`) |
| GET | /api/bookings/:id/qr | QR code tiket (SVG) |
| DELETE / PATCH | /api/bookings/:id, /api/bookings/:id/finish | batalkan / selesai |

## Deploy di EC2 (Ubuntu 24.04)
```bash
sudo bash scripts/deploy.sh https://github.com/<username>/parkirin.git
bash scripts/monitor.sh
```
