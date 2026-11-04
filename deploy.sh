#!/usr/bin/env bash
# Выкладка тренажёра на https://fasol.app (сервер 169.58.16.244).
# Первый запуск ставит nginx-конфиг и сертификат Let's Encrypt; дальше — только файлы.
set -euo pipefail
cd "$(dirname "$0")"
KEY=~/.ssh/id_rsa_169.58.16.244
HOST=root@169.58.16.244
SSH="ssh -i $KEY $HOST"

echo "→ сборка"
(cd app && npm run build)

echo "→ файлы"
$SSH 'mkdir -p /var/www/fasol.app'
rsync -a --delete -e "ssh -i $KEY" app/dist/ "$HOST:/var/www/fasol.app/"
$SSH 'chown -R www-data:www-data /var/www/fasol.app'

if ! $SSH 'test -e /etc/nginx/sites-enabled/fasol.app.conf'; then
  echo "→ nginx (первый запуск)"
  scp -i "$KEY" -q deploy/fasol.app.conf "$HOST:/etc/nginx/sites-available/fasol.app.conf"
  $SSH 'ln -s /etc/nginx/sites-available/fasol.app.conf /etc/nginx/sites-enabled/fasol.app.conf'
  if ! $SSH 'nginx -t'; then
    echo "✗ конфиг nginx не прошёл проверку — откатываю"
    $SSH 'rm -f /etc/nginx/sites-enabled/fasol.app.conf'
    exit 1
  fi
  $SSH 'systemctl reload nginx'
  echo "→ сертификат"
  $SSH 'certbot --nginx -d fasol.app -d www.fasol.app --redirect --non-interactive'
fi

echo "→ проверка"
curl -s -o /dev/null -m 10 --resolve fasol.app:443:169.58.16.244 -w "  https://fasol.app  %{http_code}\n" https://fasol.app/
