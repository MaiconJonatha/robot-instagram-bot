#!/bin/bash
set -a
source "$(dirname "$0")/.env"
set +a

echo "[$(date)] Iniciando o bot do Instagram..."
node "$(dirname "$0")/single-post.js" >> /var/log/igbot.log 2>&1
