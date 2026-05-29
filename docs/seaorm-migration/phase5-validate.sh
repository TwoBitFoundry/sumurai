#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.cargo/bin:${PATH}"
LIVE_POSTGRES_CONTAINER="${LIVE_POSTGRES_CONTAINER:-sumurai-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-accounting}"
BACKUP_CIPHER="${BACKUP_CIPHER:-aes-256-cbc}"
BACKUP_KDF_ITER="${BACKUP_KDF_ITER:-310000}"

backup_archive_key=""
DATA_ENC_B64=""

log() {
  printf '[phase5-validate] %s\n' "$*"
}

fail() {
  printf '[phase5-validate] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

scrub_sensitive() {
  backup_archive_key=""
  DATA_ENC_B64=""
}

on_exit() {
  scrub_sensitive
}

encrypt_stream() {
  openssl enc -"${BACKUP_CIPHER}" -pbkdf2 -iter "${BACKUP_KDF_ITER}" -salt \
    -pass "pass:${backup_archive_key}"
}

load_secrets_from_running_stack() {
  if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
    return 0
  fi

  if ! docker inspect "${LIVE_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    fail "Set POSTGRES_PASSWORD in the environment, or start the dev stack so it can be read from ${LIVE_POSTGRES_CONTAINER}."
  fi

  POSTGRES_PASSWORD="$(
    docker inspect "${LIVE_POSTGRES_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^POSTGRES_PASSWORD=//p' | head -1
  )"

  [[ -n "${POSTGRES_PASSWORD:-}" ]] || fail "Could not resolve POSTGRES_PASSWORD."
}

count_table() {
  local table="$1"
  docker exec "${LIVE_POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A \
    -c "SELECT COUNT(*) FROM ${table};" | tr -d '[:space:]'
}

capture_live_data_backup() {
  log "Capturing encrypted live data dump in memory from ${LIVE_POSTGRES_CONTAINER} (read-only)..."
  DATA_ENC_B64="$(
    docker exec "${LIVE_POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
      --data-only --no-owner --no-privileges --disable-triggers \
      --exclude-table=_sqlx_migrations \
      --exclude-table=seaql_migrations \
      | encrypt_stream \
      | openssl base64 -A
  )"
  [[ -n "${DATA_ENC_B64}" ]] || fail "Live backup produced empty ciphertext."
  log "Live data backup held in memory ($(printf '%s' "${DATA_ENC_B64}" | wc -c | tr -d ' ') base64 bytes)."
}

verify_round_trip() {
  log "Verifying in-memory encrypt/decrypt round-trip..."
  local decrypted_users
  decrypted_users="$(
    printf '%s' "${DATA_ENC_B64}" \
      | openssl base64 -d -A \
      | openssl enc -"${BACKUP_CIPHER}" -d -pbkdf2 -iter "${BACKUP_KDF_ITER}" \
        -pass "pass:${backup_archive_key}" \
      | grep -c '^COPY public\.users ' || true
  )"
  [[ "${decrypted_users}" -ge 1 ]] || fail "Decrypted dump missing users COPY block."
  log "Round-trip OK (users COPY block present in decrypted stream)."
}

main() {
  trap on_exit EXIT

  require_cmd docker
  require_cmd openssl

  if ! docker inspect "${LIVE_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    fail "${LIVE_POSTGRES_CONTAINER} is not running. Start the dev stack first."
  fi

  backup_archive_key="$(openssl rand -hex 32)"
  load_secrets_from_running_stack

  capture_live_data_backup
  verify_round_trip

  local users txns
  users="$(count_table users)"
  txns="$(count_table transactions)"
  log "Live row counts — users=${users} transactions=${txns}"
  log "Phase 5 backup validation passed (live pg_dump, in-memory encrypt, round-trip decrypt)."
}

main "$@"
