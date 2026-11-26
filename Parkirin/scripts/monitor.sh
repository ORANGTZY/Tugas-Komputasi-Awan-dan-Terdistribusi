#!/bin/bash
# monitor.sh - script sederhana untuk memeriksa kondisi server EC2 dan aplikasi Parkirin.
# Penggunaan : bash monitor.sh            (hasil juga disimpan ke ~/monitor.log)
LOG=~/monitor.log
{
echo "===== Laporan Server $(date '+%Y-%m-%d %H:%M:%S') ====="
echo "Hostname    : $(hostname)"
echo "OS          : $(. /etc/os-release && echo "$PRETTY_NAME")"
echo "Uptime      : $(uptime -p)"
echo "CPU (jumlah): $(nproc) vCPU | Load average: $(cut -d' ' -f1-3 /proc/loadavg)"
echo "Memori      : $(free -m | awk '/Mem:/ {printf "%s MB terpakai dari %s MB (%.0f%%)", $3, $2, $3*100/$2}')"
echo "Disk (/)    : $(df -h / | awk 'NR==2 {print $3" terpakai dari "$2" ("$5")"}')"
echo "IP privat   : $(hostname -I | awk '{print $1}')"
for svc in nginx parkirin-api; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null); echo "Service $svc: ${STATUS:-tidak-ada}"
done
START=$(date +%s%3N)
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health)
echo "Health API  : HTTP $CODE ($(( $(date +%s%3N) - START )) ms)"
} | tee -a "$LOG"
