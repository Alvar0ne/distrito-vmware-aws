#!/bin/sh
set -eu

cd "$(dirname "$0")"
mkdir -p backups
. ./.env.server

timestamp="$(date +%Y%m%d-%H%M%S)"
docker compose --env-file .env.server -f docker-compose.production.yml \
  exec -T database pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "backups/distrito-miami-$timestamp.sql.gz"

find backups -type f -name '*.sql.gz' -mtime +14 -delete
echo "Backup creado: backups/distrito-miami-$timestamp.sql.gz"
