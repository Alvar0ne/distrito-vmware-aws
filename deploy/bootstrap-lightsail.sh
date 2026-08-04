#!/bin/sh
set -eu

sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip docker.io

if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose-plugin
fi

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

mkdir -p "$HOME/distrito-miami"

echo "Servidor preparado. Cierra la sesion SSH y vuelve a conectarte para usar Docker sin sudo."
docker --version
docker compose version || true
free -h
