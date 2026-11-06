#!/usr/bin/env bash
# Выкладка сервера аккаунтов fasol.app (server/) в Docker на 169.58.16.244.
# Ключи входа лежат на сервере в /opt/fasol-api/.env (chmod 600) и сюда не попадают.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=~/.ssh/id_rsa_169.58.16.244
HOST=root@169.58.16.244
SSH="ssh -i $KEY $HOST"

$SSH 'mkdir -p /opt/fasol-api/data && chown 1000:1000 /opt/fasol-api/data && touch /opt/fasol-api/.env && chmod 600 /opt/fasol-api/.env'
rsync -a -e "ssh -i $KEY" server/index.mjs server/Dockerfile "$HOST:/opt/fasol-api/"
$SSH 'cd /opt/fasol-api && docker build -q -t fasol-api . >/dev/null && (docker rm -f fasol-api >/dev/null 2>&1 || true) && docker run -d --name fasol-api --restart unless-stopped -p 127.0.0.1:8787:8787 -v /opt/fasol-api/data:/data --env-file /opt/fasol-api/.env -e BASE_URL=https://fasol.app fasol-api >/dev/null'

# nginx: лимит частоты (5 запросов в секунду с адреса) и блок /api — пересобираются при каждой выкладке
$SSH 'printf "limit_req_zone \$binary_remote_addr zone=fasol_api:10m rate=5r/s;\nlimit_req_zone \$binary_remote_addr zone=fasol_auth:10m rate=5r/m;\nlimit_req_zone \$binary_remote_addr zone=fasol_push:10m rate=10r/m;\n" > /etc/nginx/conf.d/fasol-api-limit.conf'
API_LOC='    location ~ ^/api/push/(subscribe|unsubscribe)$ { limit_req zone=fasol_push burst=5 nodelay; proxy_pass http://127.0.0.1:8787; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; }\n    location ~ ^/api/(login|register|reset/request|reset/confirm)$ { limit_req zone=fasol_auth burst=10 nodelay; proxy_pass http://127.0.0.1:8787; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; }\n    location /api/ { limit_req zone=fasol_api burst=20 nodelay; client_max_body_size 2m; proxy_pass http://127.0.0.1:8787; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; }'
$SSH "cp /etc/nginx/sites-available/fasol.app.conf /etc/nginx/sites-available/fasol.app.conf.bak && sed -i '/^    location \/api\/ /d; /^    location ~ \^\/api\//d' /etc/nginx/sites-available/fasol.app.conf && sed -i 's#^    location / { try_files#$API_LOC\n    location / { try_files#' /etc/nginx/sites-available/fasol.app.conf"
if ! $SSH 'nginx -t 2>/dev/null'; then $SSH 'cp /etc/nginx/sites-available/fasol.app.conf.bak /etc/nginx/sites-available/fasol.app.conf'; echo "✗ nginx — откатил"; exit 1; fi
$SSH 'systemctl reload nginx'
sleep 2
echo "→ проверка"; curl -s https://fasol.app/api/health; echo; curl -s https://fasol.app/api/providers; echo
