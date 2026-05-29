#!/usr/bin/env bash
set -euo pipefail

/app/docker-migrate.sh
exec /app/sumurai-backend
