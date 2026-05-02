#!/bin/sh
set -eu

ENTRYPOINT_PATH="${ENTRYPOINT_PATH:-/etc/nginx/entrypoint.sh}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1/healthz}"
SUMURAI_ENTRYPOINT_TEST=1
export SUMURAI_ENTRYPOINT_TEST

. "${ENTRYPOINT_PATH}"

check_certificate_health() {
  mode="$(runtime_mode)"

  if ! certificate_exists; then
    printf 'TLS_PROVISIONING_ERROR domain=%s certificate=%s reason=missing_certificate\n' "${DOMAIN}" "${FULLCHAIN}" >&2
    return 1
  fi

  if [ "${mode}" = "production" ] && certificate_is_self_signed; then
    printf 'TLS_PROVISIONING_ERROR domain=%s certificate=%s reason=self_signed_certificate\n' "${DOMAIN}" "${FULLCHAIN}" >&2
    return 1
  fi

  if certificate_expires_within_days "${EXPIRY_WARNING_DAYS}"; then
    if [ "${mode}" = "production" ]; then
      printf 'TLS_PROVISIONING_ERROR domain=%s certificate=%s reason=certificate_expires_within_%s_days not_after=%s\n' "${DOMAIN}" "${FULLCHAIN}" "${EXPIRY_WARNING_DAYS}" "$(certificate_not_after)" >&2
      return 1
    fi

    printf 'TLS_PROVISIONING_WARNING domain=%s certificate=%s reason=certificate_expires_within_%s_days not_after=%s\n' "${DOMAIN}" "${FULLCHAIN}" "${EXPIRY_WARNING_DAYS}" "$(certificate_not_after)" >&2
  fi
}

check_http_health() {
  wget -q -O- "${HEALTHCHECK_URL}" >/dev/null
}

run_healthcheck() {
  check_certificate_health
  check_http_health
}

if [ "${SUMURAI_HEALTHCHECK_TEST:-0}" != "1" ]; then
  run_healthcheck
fi
