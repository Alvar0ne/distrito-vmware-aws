#!/bin/sh
set -eu

DEPLOY_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$DEPLOY_DIR")"
COMPOSE="docker compose --env-file $DEPLOY_DIR/.env.server -f $DEPLOY_DIR/docker-compose.production.yml"

sed -i 's/\r$//' "$DEPLOY_DIR/.env.server" "$DEPLOY_DIR"/*.sh 2>/dev/null || true

APP_IMAGE="$(sed -n 's/^APP_IMAGE=//p' "$DEPLOY_DIR/.env.server" | head -n 1)"

if [ -z "$APP_IMAGE" ]; then
  echo "Falta APP_IMAGE en deploy/.env.server"
  exit 1
fi

echo "1/3 Construyendo la nueva version..."
docker build -t "$APP_IMAGE" "$APP_DIR"

echo "2/3 Reiniciando aplicacion y proxy..."
$COMPOSE up -d --force-recreate app caddy

echo "3/3 Verificando servicios..."
$COMPOSE ps

echo "Actualizacion terminada."
