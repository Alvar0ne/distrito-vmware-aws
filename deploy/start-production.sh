#!/bin/sh
set -eu

cd "$(dirname "$0")"
docker compose --env-file .env.server -f docker-compose.production.yml up -d
docker compose --env-file .env.server -f docker-compose.production.yml ps
