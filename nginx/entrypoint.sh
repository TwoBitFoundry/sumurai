#!/bin/sh
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
SSL_PORT="${SSL_PORT:-8443}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${CERT_DIR}/fullchain.pem"
PRIVKEY="${CERT_DIR}/privkey.pem"

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

main() {
  if ! command -v openssl >/dev/null 2>&1 || ! command -v envsubst >/dev/null 2>&1; then
    apk add --no-cache openssl gettext >/dev/null
  fi

  mkdir -p "${CERT_DIR}"
  mkdir -p /var/www/certbot

  echo "TLS runtime mode: $(runtime_mode)"

  # Generate a self-signed cert if none exists (useful for first boot/local)
  if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
    echo "Generating self-signed certificate for ${DOMAIN}"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "${PRIVKEY}" \
      -out "${FULLCHAIN}" \
      -subj "/CN=${DOMAIN}" >/dev/null 2>&1
  fi

  # Render nginx config from template with env vars
  export DOMAIN SSL_PORT
  envsubst '${DOMAIN} ${SSL_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

  exec nginx -g "daemon off;"
}

if [ "${SUMURAI_ENTRYPOINT_TEST:-0}" != "1" ]; then
  main "$@"
fi
