#!/bin/sh
set -eu

DEPLOY_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$DEPLOY_DIR")"
COMPOSE="docker compose --env-file $DEPLOY_DIR/.env.server -f $DEPLOY_DIR/docker-compose.production.yml"
APP_IMAGE="$(sed -n 's/^APP_IMAGE=//p' "$DEPLOY_DIR/.env.server" | head -n 1)"

if [ -z "$APP_IMAGE" ]; then
  echo "Falta APP_IMAGE en deploy/.env.server"
  exit 1
fi

echo "1/4 Construyendo la aplicacion..."
docker build -t "$APP_IMAGE" "$APP_DIR"

echo "2/4 Iniciando PostgreSQL..."
$COMPOSE up -d database

echo "3/4 Migrando catalogo, clientes y pedidos..."
$COMPOSE run --rm app node scripts/seed-products.mjs

echo "4/4 Iniciando tienda y HTTPS..."
$COMPOSE up -d
$COMPOSE ps

echo "Instalacion terminada. Revisa el estado con:"
echo "$COMPOSE ps"
