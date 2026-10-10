#!/bin/sh
# Calls every client's daily job. A client is a clients/<name>.env file with
# a CRON_SECRET; its service in docker-compose.yml has the same name.
for env in /clients/*.env; do
  name=$(basename "$env" .env)
  secret=$(grep -E '^CRON_SECRET=' "$env" | head -1 | cut -d= -f2- | tr -d '"')
  [ -n "$secret" ] || continue
  wget -qO- --timeout=300 --header "Authorization: Bearer $secret" "http://$name:3000/api/cron/daily" >/dev/null \
    && echo "$(date) $name ok" || echo "$(date) $name FAILED"
done
