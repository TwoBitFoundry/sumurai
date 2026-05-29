#!/usr/bin/env bash
set -euo pipefail

ARTIFACTS="${MIGRATION_ARTIFACTS_DIR:-/var/lib/sumurai/migration}"
READY_MARKER="${ARTIFACTS}/.seaorm-ready"
POSTGRES_DB="${POSTGRES_DB:-accounting}"
STAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_PATH="${ARTIFACTS}/sumurai-pre-cutover-${STAMP}.dump"
DATA_PATH="${ARTIFACTS}/sumurai-data-${STAMP}.sql"

MIGRATION_SUCCEEDED=0
ROLLBACK_NEEDED=0
ROLLBACK_IN_PROGRESS=0
DB_STATE=""
EXPECTED_USERS=""
EXPECTED_TXNS=""

log() {
  printf '[migrate] %s\n' "$*"
}

fail() {
  printf '[migrate] ERROR: %s\n' "$*" >&2
  exit 1
}

require_env() {
  [[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required"
}

mark_seaorm_ready() {
  mkdir -p "${ARTIFACTS}"
  date -u +%Y-%m-%dT%H:%M:%SZ >"${READY_MARKER}"
}

is_seaorm_database() {
  psql "${DATABASE_URL}" -t -A -v ON_ERROR_STOP=1 <<'SQL' | grep -qx 't'
SELECT COALESCE(
  to_regclass('public.seaql_migrations') IS NOT NULL
  AND to_regclass('public._sqlx_migrations') IS NULL,
  false
);
SQL
}

try_fast_path() {
  [[ -f "${READY_MARKER}" ]] || return 1
  require_env

  if is_seaorm_database; then
    return 0
  fi

  if psql "${DATABASE_URL}" -c "SELECT 1" >/dev/null 2>&1; then
    log "SeaORM ready marker is stale — re-running migration checks."
    rm -f "${READY_MARKER}"
  fi

  return 1
}

admin_database_url() {
  local url="${DATABASE_URL}"
  if [[ "${url}" == *"/${POSTGRES_DB}?"* ]]; then
    printf '%s' "${url//\/${POSTGRES_DB}?/\/postgres?}"
  elif [[ "${url}" == *"/${POSTGRES_DB}" ]]; then
    printf '%s' "${url%/${POSTGRES_DB}}/postgres"
  else
    fail "DATABASE_URL must include /${POSTGRES_DB}"
  fi
}

wait_for_postgres() {
  for _ in $(seq 1 60); do
    if psql "${DATABASE_URL}" -c "SELECT 1" >/dev/null 2>&1 \
      || psql "$(admin_database_url)" -c "SELECT 1" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "Postgres did not become reachable"
}

detect_db_state() {
  local has_sqlx has_seaorm has_users query_result

  if ! query_result="$(
    psql "${DATABASE_URL}" -t -A -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  COALESCE(to_regclass('public._sqlx_migrations') IS NOT NULL, false),
  COALESCE(to_regclass('public.seaql_migrations') IS NOT NULL, false),
  COALESCE(to_regclass('public.users') IS NOT NULL, false);
SQL
  )"; then
    if psql "$(admin_database_url)" -t -A -c "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}');" | grep -qx 't'; then
      fail "Database ${POSTGRES_DB} exists but schema detection failed"
    fi
    DB_STATE="empty"
    log "Database state: empty (${POSTGRES_DB} not found)"
    return 0
  fi

  IFS='|' read -r has_sqlx has_seaorm has_users <<<"${query_result}"

  if [[ "${has_seaorm}" == "t" && "${has_sqlx}" == "f" ]]; then
    DB_STATE="already_seaorm"
  elif [[ "${has_sqlx}" == "t" || ( "${has_users}" == "t" && "${has_seaorm}" == "f" ) ]]; then
    DB_STATE="legacy"
  else
    DB_STATE="empty"
  fi
  log "Database state: ${DB_STATE} (sqlx=${has_sqlx} seaorm=${has_seaorm} users=${has_users})"
}

ensure_database_exists() {
  if psql "$(admin_database_url)" -t -A -c "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}');" | grep -qx 't'; then
    return 0
  fi
  log "Creating database ${POSTGRES_DB}..."
  psql "$(admin_database_url)" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${POSTGRES_DB};"
}

count_table() {
  psql "${DATABASE_URL}" -t -A -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM ${1};" | tr -d '[:space:]'
}

verify_snapshot() {
  [[ -s "${SNAPSHOT_PATH}" ]] || fail "Snapshot missing or empty: ${SNAPSHOT_PATH}"
  pg_restore --list "${SNAPSHOT_PATH}" >/dev/null 2>&1 || fail "Invalid snapshot: ${SNAPSHOT_PATH}"
}

take_snapshot() {
  mkdir -p "${ARTIFACTS}"
  log "Snapshot (rollback artifact)..."
  pg_dump "${DATABASE_URL}" --no-owner --no-privileges -Fc >"${SNAPSHOT_PATH}"
  verify_snapshot
  ln -sf "$(basename "${SNAPSHOT_PATH}")" "${ARTIFACTS}/sumurai-pre-cutover-latest.dump"
}

take_data_dump() {
  log "Data-only export..."
  pg_dump "${DATABASE_URL}" \
    --data-only --no-owner --no-privileges --disable-triggers \
    --exclude-table=_sqlx_migrations \
    --exclude-table=seaql_migrations \
    >"${DATA_PATH}"
  [[ -s "${DATA_PATH}" ]] || fail "Data dump is empty: ${DATA_PATH}"
  ln -sf "$(basename "${DATA_PATH}")" "${ARTIFACTS}/sumurai-data-latest.sql"

  EXPECTED_USERS="$(count_table users)"
  EXPECTED_TXNS="$(count_table transactions)"
  log "Baseline row counts — users=${EXPECTED_USERS} transactions=${EXPECTED_TXNS}"
}

drop_and_recreate_database() {
  local admin_url
  admin_url="$(admin_database_url)"
  log "Recreate database ${POSTGRES_DB}..."
  ROLLBACK_NEEDED=1
  psql "${admin_url}" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${POSTGRES_DB};
CREATE DATABASE ${POSTGRES_DB};
SQL
}

apply_seaorm_schema() {
  log "Applying SeaORM migrations..."
  /app/migration up
}

restore_data() {
  log "Restore data from ${DATA_PATH}..."
  grep -Ev '^(SET transaction_timeout|SET idle_in_transaction_session_timeout)' "${DATA_PATH}" \
    | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1
}

verify_cutover() {
  local users txns has_sqlx
  users="$(count_table users)"
  txns="$(count_table transactions)"
  has_sqlx="$(psql "${DATABASE_URL}" -t -A -c "SELECT to_regclass('public._sqlx_migrations') IS NOT NULL;" | tr -d '[:space:]')"

  psql "${DATABASE_URL}" -c "SELECT 1 FROM seaql_migrations LIMIT 1;" >/dev/null \
    || fail "seaql_migrations missing after cutover"
  [[ "${has_sqlx}" == "f" ]] || fail "_sqlx_migrations still present after cutover"
  [[ "${users}" == "${EXPECTED_USERS}" ]] \
    || fail "User count mismatch (expected ${EXPECTED_USERS}, got ${users})"
  [[ "${txns}" == "${EXPECTED_TXNS}" ]] \
    || fail "Transaction count mismatch (expected ${EXPECTED_TXNS}, got ${txns})"
  log "Cutover verified — users=${users} transactions=${txns}"
}

rollback_migration() {
  if (( MIGRATION_SUCCEEDED == 1 || ROLLBACK_NEEDED == 0 || ROLLBACK_IN_PROGRESS == 1 )); then
    return 0
  fi
  ROLLBACK_IN_PROGRESS=1
  log "Cutover failed — restoring snapshot ${SNAPSHOT_PATH}..."

  set +e
  drop_and_recreate_database
  pg_restore -d "${DATABASE_URL}" --no-owner --no-privileges <"${SNAPSHOT_PATH}"
  local restore_code=$?
  set -e

  if (( restore_code != 0 )); then
    printf '[migrate] ERROR: rollback pg_restore failed — recover manually from %s\n' "${SNAPSHOT_PATH}" >&2
    return 1
  fi

  local users txns
  users="$(count_table users)"
  txns="$(count_table transactions)"
  log "Rollback complete — users=${users} transactions=${txns}"
}

on_exit() {
  local code=$?
  if (( code != 0 && ROLLBACK_NEEDED == 1 && MIGRATION_SUCCEEDED == 0 )); then
    rollback_migration || true
    log "Cutover failed; database restored from snapshot when possible."
    exit 1
  fi
}

run_legacy_cutover() {
  take_snapshot
  take_data_dump
  drop_and_recreate_database
  apply_seaorm_schema
  restore_data
  verify_cutover
  MIGRATION_SUCCEEDED=1
  ROLLBACK_NEEDED=0
  log "Legacy cutover succeeded. Snapshot: ${SNAPSHOT_PATH}"
}

main() {
  if try_fast_path; then
    exit 0
  fi

  trap on_exit EXIT
  require_env
  wait_for_postgres
  detect_db_state

  case "${DB_STATE}" in
    already_seaorm)
      mark_seaorm_ready
      log "Already on SeaORM — no cutover needed."
      exit 0
      ;;
    empty)
      ensure_database_exists
      log "Empty database — applying SeaORM schema."
      apply_seaorm_schema
      MIGRATION_SUCCEEDED=1
      mark_seaorm_ready
      exit 0
      ;;
    legacy)
      log "Legacy SQLx database detected — starting cutover."
      run_legacy_cutover
      mark_seaorm_ready
      exit 0
      ;;
    *)
      fail "Unknown database state: ${DB_STATE}"
      ;;
  esac
}

main "$@"
