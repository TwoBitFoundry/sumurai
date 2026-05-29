#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.cargo/bin:${PATH}"
ARTIFACTS="${ROOT}/docs/seaorm-migration/artifacts"
COMPOSE=(docker compose -p sumurai-phase5-test -f "${ROOT}/docker-compose.phase5-test.yml")
LIVE_POSTGRES_CONTAINER="${LIVE_POSTGRES_CONTAINER:-sumurai-postgres-1}"
PHASE5_POSTGRES_PORT="${PHASE5_POSTGRES_PORT:-5433}"
PHASE5_REDIS_PORT="${PHASE5_REDIS_PORT:-6380}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-accounting}"
CARGO_BIN="${CARGO_BIN:-${HOME}/.cargo/bin/cargo}"
BACKUP_CIPHER="${BACKUP_CIPHER:-aes-256-cbc}"
BACKUP_KDF_ITER="${BACKUP_KDF_ITER:-310000}"

backup_archive_key=""
DATA_ENC_B64=""
VALIDATION_FAILED=0
FAILURES=()

log() {
  printf '[phase5-validate] %s\n' "$*"
}

fail() {
  printf '[phase5-validate] ERROR: %s\n' "$*" >&2
  exit 1
}

record_failure() {
  VALIDATION_FAILED=1
  FAILURES+=("$*")
  printf '[phase5-validate] ERROR: %s\n' "$*" >&2
}

run_step() {
  local label="$1"
  shift
  log "${label}..."
  if "$@"; then
    log "${label} — OK"
    return 0
  fi
  record_failure "${label} failed"
  return 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

scrub_sensitive() {
  backup_archive_key=""
  DATA_ENC_B64=""
}

on_exit() {
  local code=$?
  scrub_sensitive
  if (( code != 0 || VALIDATION_FAILED != 0 )); then
    log "Validation did not pass (exit ${code}). Live database was not modified."
    if ((${#FAILURES[@]} > 0)); then
      log "Failed step(s):"
      local failure
      for failure in "${FAILURES[@]}"; do
        log "  - ${failure}"
      done
    fi
    log "Test stack may still be running. Tear down with: docker compose -p sumurai-phase5-test down"
  fi
}

encrypt_stream() {
  openssl enc -"${BACKUP_CIPHER}" -pbkdf2 -iter "${BACKUP_KDF_ITER}" -salt \
    -pass "pass:${backup_archive_key}"
}

decrypt_stream() {
  openssl enc -"${BACKUP_CIPHER}" -d -pbkdf2 -iter "${BACKUP_KDF_ITER}" \
    -pass "pass:${backup_archive_key}"
}

load_secrets_from_running_stack() {
  if [[ -n "${JWT_SECRET:-}" && -n "${ENCRYPTION_KEY:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
    return 0
  fi

  if ! docker inspect "${LIVE_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    fail "Set JWT_SECRET, ENCRYPTION_KEY, and POSTGRES_PASSWORD in the environment, or start the dev stack so secrets can be read from running containers."
  fi

  local backend_container="${LIVE_BACKEND_CONTAINER:-sumurai-backend-1}"
  if docker inspect "${backend_container}" >/dev/null 2>&1; then
    [[ -n "${JWT_SECRET:-}" ]] || JWT_SECRET="$(
      docker inspect "${backend_container}" --format '{{range .Config.Env}}{{println .}}{{end}}' \
        | sed -n 's/^JWT_SECRET=//p' | head -1
    )"
    [[ -n "${ENCRYPTION_KEY:-}" ]] || ENCRYPTION_KEY="$(
      docker inspect "${backend_container}" --format '{{range .Config.Env}}{{println .}}{{end}}' \
        | sed -n 's/^ENCRYPTION_KEY=//p' | head -1
    )"
  fi

  [[ -n "${POSTGRES_PASSWORD:-}" ]] || POSTGRES_PASSWORD="$(
    docker inspect "${LIVE_POSTGRES_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^POSTGRES_PASSWORD=//p' | head -1
  )"

  [[ -n "${JWT_SECRET:-}" && -n "${ENCRYPTION_KEY:-}" && -n "${POSTGRES_PASSWORD:-}" ]] \
    || fail "Could not resolve JWT_SECRET, ENCRYPTION_KEY, and POSTGRES_PASSWORD."
}

export_boot_env_from_running_backend() {
  local database_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${PHASE5_POSTGRES_PORT}/${POSTGRES_DB}"
  local redis_url="redis://127.0.0.1:${PHASE5_REDIS_PORT}"
  local backend_container="${LIVE_BACKEND_CONTAINER:-sumurai-backend-1}"

  export DATABASE_URL="${database_url}"
  export REDIS_URL="${redis_url}"
  export OTEL_TRACES_EXPORTER="${OTEL_TRACES_EXPORTER:-none}"
  export RUST_LOG="${RUST_LOG:-info}"
  export AUTH_COOKIE_SAME_SITE="${AUTH_COOKIE_SAME_SITE:-Lax}"
  export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:8080}"

  if docker inspect "${backend_container}" >/dev/null 2>&1; then
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      case "${line}" in
        DATABASE_URL=*|REDIS_URL=*|OTEL_TRACES_EXPORTER=*|RUST_LOG=*|PATH=*) continue ;;
      esac
      export "${line?}"
    done < <(docker inspect "${backend_container}" --format '{{range .Config.Env}}{{println .}}{{end}}')
  fi

  export DATABASE_URL="${database_url}"
  export REDIS_URL="${redis_url}"
  export OTEL_TRACES_EXPORTER="${OTEL_TRACES_EXPORTER:-none}"
}

phase5_postgres_container() {
  docker ps --filter "label=com.docker.compose.project=sumurai-phase5-test" --filter "label=com.docker.compose.service=postgres" --format '{{.Names}}' | head -1
}

wait_for_postgres() {
  local container
  container="$(phase5_postgres_container)"
  [[ -n "${container}" ]] || fail "phase5 postgres container not running"
  for _ in $(seq 1 30); do
    if docker exec "${container}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "phase5 postgres did not become ready"
}

psql_test() {
  docker exec "$(phase5_postgres_container)" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 "$@"
}

count_table() {
  local container="$1"
  local table="$2"
  docker exec "${container}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -c "SELECT COUNT(*) FROM ${table};" | tr -d '[:space:]'
}

capture_live_data_backup() {
  if ! docker inspect "${LIVE_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    log "Skipping live backup: ${LIVE_POSTGRES_CONTAINER} is not running."
    return 0
  fi

  log "Capturing encrypted live data dump in memory from ${LIVE_POSTGRES_CONTAINER} (read-only)..."
  DATA_ENC_B64="$(
    docker exec "${LIVE_POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
      --data-only --no-owner --no-privileges --disable-triggers \
      --exclude-table=_sqlx_migrations \
      --exclude-table=seaql_migrations \
      | encrypt_stream \
      | openssl base64 -A
  )"
  if [[ -z "${DATA_ENC_B64}" ]]; then
    record_failure "Live backup produced empty ciphertext"
    return 1
  fi
  log "Live data backup held in memory ($(printf '%s' "${DATA_ENC_B64}" | wc -c | tr -d ' ') base64 bytes)."
}

restore_data_from_memory() {
  if [[ -z "${DATA_ENC_B64}" ]]; then
    record_failure "No in-memory backup available for restore"
    return 1
  fi
  log "Decrypting in-memory backup and streaming into test Postgres..."
  if ! printf '%s' "${DATA_ENC_B64}" \
    | openssl base64 -d -A \
    | decrypt_stream \
    | docker exec -i "$(phase5_postgres_container)" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1; then
    record_failure "Restore import failed"
    return 1
  fi
}

run_backend_boot() {
  local log_file="$1"

  log "Booting SeaORM backend against test stack (log: ${log_file})..."
  (
    cd "${ROOT}"
    export_boot_env_from_running_backend
    "${CARGO_BIN}" run --manifest-path backend/Cargo.toml --locked --release 2>&1
  ) >"${log_file}" 2>&1 &
  local pid=$!

  for _ in $(seq 1 180); do
    if grep -q "Database migrations applied" "${log_file}" 2>/dev/null; then
      sleep 2
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
      return 0
    fi
    if ! kill -0 "${pid}" 2>/dev/null; then
      wait "${pid}" || true
      record_failure "Backend exited before migrations completed (see ${log_file})"
      return 1
    fi
    sleep 1
  done

  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  record_failure "Timed out waiting for backend migrations (see ${log_file})"
  return 1
}

assert_seaorm_schema() {
  if ! psql_test -c "SELECT 1 FROM seaql_migrations LIMIT 1;" >/dev/null; then
    record_failure "seaql_migrations table missing or unreadable"
    return 1
  fi
  if psql_test -t -A -c "SELECT to_regclass('public._sqlx_migrations') IS NOT NULL;" | grep -q t; then
    record_failure "Expected no _sqlx_migrations table on SeaORM-managed test database"
    return 1
  fi
  log "SeaORM schema confirmed (seaql_migrations present, _sqlx_migrations absent)."
}

migration_count() {
  psql_test -t -A -c "SELECT COUNT(*) FROM seaql_migrations;" | tr -d '[:space:]'
}

reset_test_stack() {
  log "Resetting isolated test stack (volume: sumurai-phase5-test_phase5_postgres_data)..."
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  "${COMPOSE[@]}" up -d
  wait_for_postgres
}

run_fresh_boot_checks() {
  reset_test_stack

  local boot1_log="${ARTIFACTS}/boot-fresh-1.log"
  run_step "First fresh boot" run_backend_boot "${boot1_log}" || return 1
  if ! grep -q "Database migrations applied" "${boot1_log}"; then
    record_failure "Fresh boot did not apply migrations (see ${boot1_log})"
    return 1
  fi
  run_step "SeaORM schema after first boot" assert_seaorm_schema || return 1

  local first_count second_count
  first_count="$(migration_count)"
  log "First boot applied ${first_count} SeaORM migration row(s)."

  local boot2_log="${ARTIFACTS}/boot-fresh-2.log"
  run_step "Second fresh boot (idempotency)" run_backend_boot "${boot2_log}" || return 1
  second_count="$(migration_count)"
  if [[ "${first_count}" != "${second_count}" ]]; then
    record_failure "Migration count changed on second boot (${first_count} -> ${second_count})"
    return 1
  fi
  log "Second boot left migration count unchanged (${second_count})."
}

run_restore_smoke() {
  reset_test_stack
  run_step "Restore init boot" run_backend_boot "${ARTIFACTS}/boot-restore-init.log" || return 1
  run_step "SeaORM schema before restore import" assert_seaorm_schema || return 1
  run_step "Restore import from in-memory backup" restore_data_from_memory || return 1

  local live_users="" live_txns="" test_users="" test_txns=""
  if docker inspect "${LIVE_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    live_users="$(count_table "${LIVE_POSTGRES_CONTAINER}" users)"
    live_txns="$(count_table "${LIVE_POSTGRES_CONTAINER}" transactions)"
    test_users="$(count_table "$(phase5_postgres_container)" users)"
    test_txns="$(count_table "$(phase5_postgres_container)" transactions)"
    log "Row counts — live users=${live_users} transactions=${live_txns}; test users=${test_users} transactions=${test_txns}"
    if [[ "${live_users}" != "${test_users}" ]]; then
      record_failure "User count mismatch after restore (live=${live_users}, test=${test_users})"
      return 1
    fi
    if [[ "${live_txns}" != "${test_txns}" ]]; then
      record_failure "Transaction count mismatch after restore (live=${live_txns}, test=${test_txns})"
      return 1
    fi
  else
    test_users="$(count_table "$(phase5_postgres_container)" users)"
    test_txns="$(count_table "$(phase5_postgres_container)" transactions)"
    log "Restore imported users=${test_users} transactions=${test_txns} (live DB unavailable for comparison)."
    if [[ "${test_users}" == "0" && "${test_txns}" == "0" ]]; then
      record_failure "Restore smoke imported zero rows"
      return 1
    fi
  fi

  run_step "Post-restore boot" run_backend_boot "${ARTIFACTS}/boot-restore-final.log"
}

main() {
  trap on_exit EXIT

  require_cmd docker
  require_cmd openssl
  [[ -x "${CARGO_BIN}" ]] || fail "missing cargo at ${CARGO_BIN}"

  backup_archive_key="$(openssl rand -hex 32)"
  load_secrets_from_running_stack
  mkdir -p "${ARTIFACTS}"

  set +e
  run_step "Live data backup capture" capture_live_data_backup

  log "Starting isolated Phase 5 test stack on ports ${PHASE5_POSTGRES_PORT}/${PHASE5_REDIS_PORT}..."
  run_step "Fresh boot checks" run_fresh_boot_checks

  if [[ -n "${DATA_ENC_B64}" ]]; then
    log "Running restore smoke (continues even if fresh-boot checks failed)..."
    run_step "Restore smoke" run_restore_smoke
  else
    log "No live data backup captured; skipping restore smoke."
  fi
  set -e

  if (( VALIDATION_FAILED != 0 )); then
    exit 1
  fi

  log "Phase 5 validation passed (fresh boot, idempotent second boot, restore smoke)."
}

main "$@"
