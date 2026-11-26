#!/bin/bash
# deploy.sh - memasang aplikasi Parkirin pada Ubuntu 24.04 (EC2).
# Penggunaan : sudo bash deploy.sh https://github.com/<username>/parkirin.git
# Hasil      : front-end disajikan Nginx (port 80), back-end Node.js berjalan sebagai service (port 3000),
#              Nginx meneruskan /api/* ke back-end sehingga browser hanya perlu satu alamat.
set -euo pipefail

REPO_URL="${1:?Isi URL repo GitHub, contoh: bash deploy.sh https://github.com/user/parkirin.git}"
APP_DIR=/opt/parkirin

echo "[1/5] Memperbarui paket dan memasang Nginx, Git, Node.js 20..."
apt-get update -y
apt-get install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[2/5] Mengambil kode dari GitHub..."
rm -rf "$APP_DIR" && git clone "$REPO_URL" "$APP_DIR"

echo "[3/5] Memasang dependensi back-end..."
(cd "$APP_DIR/backend" && npm ci --omit=dev)

echo "[4/5] Mendaftarkan back-end sebagai service systemd..."
cat > /etc/systemd/system/parkirin-api.service <<UNIT
[Unit]
Description=Parkirin API (Node.js)
After=network.target
[Service]
WorkingDirectory=$APP_DIR/backend
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now parkirin-api

echo "[5/5] Mengatur Nginx (front-end statis + proxy /api)..."
echo "window.PARKIRIN_API = '';" > "$APP_DIR/frontend/config.js"   # API di origin yang sama (lewat Nginx)
cat > /etc/nginx/sites-available/parkirin <<NGINX
server {
    listen 80 default_server;
    root $APP_DIR/frontend;
    index index.html;
    location /api/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host \$host; }
    location /     { try_files \$uri /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/parkirin /etc/nginx/sites-enabled/parkirin
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "Selesai. Uji: curl http://localhost/api/health"
