#!/bin/sh
set -eu

: "${DATABASE_PATH:=/app/data/tasks.db}"
mkdir -p "$(dirname "$DATABASE_PATH")"
python -c 'from app import init_db; init_db()'
echo "[TaskFlow] Database initialized; starting service as $(id -un) (UID $(id -u))."
exec "$@"
