#!/bin/sh
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
SSL_PORT="${SSL_PORT:-8443}"
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live/${DOMAIN}}"
FULLCHAIN="${FULLCHAIN:-${CERT_DIR}/fullchain.pem}"
PRIVKEY="${PRIVKEY:-${CERT_DIR}/privkey.pem}"
EXPIRY_WARNING_DAYS="${EXPIRY_WARNING_DAYS:-14}"

runtime_mode() {
  if [ "${ENVIRONMENT:-}" = "production" ]; then
    printf '%s\n' "production"
    return 0
  fi

  case "${DOMAIN:-}" in
    ""|localhost|127.0.0.1)
      printf '%s\n' "development"
      ;;
    *)
      printf '%s\n' "production"
      ;;
  esac
}

certificate_exists() {
  [ -s "${FULLCHAIN}" ] && [ -s "${PRIVKEY}" ]
}

certificate_subject() {
  openssl x509 -noout -subject -in "${FULLCHAIN}" 2>/dev/null | sed 's/^subject=//'
}

certificate_issuer() {
  openssl x509 -noout -issuer -in "${FULLCHAIN}" 2>/dev/null | sed 's/^issuer=//'
}

certificate_is_self_signed() {
  [ "$(certificate_subject)" = "$(certificate_issuer)" ]
}

certificate_expires_within_days() {
  days="$1"
  seconds=$((days * 86400))
  ! openssl x509 -checkend "${seconds}" -noout -in "${FULLCHAIN}" >/dev/null 2>&1
}

certificate_not_after() {
  openssl x509 -noout -enddate -in "${FULLCHAIN}" 2>/dev/null | sed 's/^notAfter=//'
}

log_certificate_status() {
  mode="$(runtime_mode)"
  self_signed="unknown"
  expires_within_warning="unknown"
  not_after="missing"

  if certificate_exists; then
    if certificate_is_self_signed; then
      self_signed="true"
    else
      self_signed="false"
    fi

    if certificate_expires_within_days "${EXPIRY_WARNING_DAYS}"; then
      expires_within_warning="true"
    else
      expires_within_warning="false"
    fi

    not_after="$(certificate_not_after)"
  fi

  printf 'TLS_PROVISIONING_STATUS domain=%s mode=%s certificate=%s self_signed=%s expires_within_%s_days=%s not_after=%s\n' \
    "${DOMAIN}" "${mode}" "${FULLCHAIN}" "${self_signed}" "${EXPIRY_WARNING_DAYS}" "${expires_within_warning}" "${not_after}"
}

main() {
  if ! command -v openssl >/dev/null 2>&1 || ! command -v envsubst >/dev/null 2>&1; then
    apk add --no-cache openssl gettext >/dev/null
  fi

  mkdir -p "${CERT_DIR}"
  mkdir -p /var/www/certbot

  echo "TLS runtime mode: $(runtime_mode)"

  if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
    echo "Generating self-signed certificate for ${DOMAIN}"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "${PRIVKEY}" \
      -out "${FULLCHAIN}" \
      -subj "/CN=${DOMAIN}" >/dev/null 2>&1
  fi

  log_certificate_status

  export DOMAIN SSL_PORT
  envsubst '${DOMAIN} ${SSL_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

  exec nginx -g "daemon off;"
}

if [ "${SUMURAI_ENTRYPOINT_TEST:-0}" != "1" ]; then
  main "$@"
fi
