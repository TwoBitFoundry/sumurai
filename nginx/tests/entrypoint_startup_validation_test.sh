#!/bin/sh
set -eu

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
ENTRYPOINT="${REPO_ROOT}/nginx/entrypoint.sh"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

assert_success() {
  if ! "$@"; then
    printf 'expected success: %s\n' "$*" >&2
    exit 1
  fi
}

assert_failure() {
  if "$@"; then
    printf 'expected failure: %s\n' "$*" >&2
    exit 1
  fi
}

file_mtime() {
  if stat -c %Y "$1" >/dev/null 2>&1; then
    stat -c %Y "$1"
    return 0
  fi

  stat -f %m "$1"
}

load_entrypoint() {
  domain="$1"
  environment="$2"
  cert_dir="$3"
  unset FULLCHAIN
  unset PRIVKEY
  DOMAIN="${domain}"
  ENVIRONMENT="${environment}"
  CERT_DIR="${cert_dir}"
  SUMURAI_ENTRYPOINT_TEST=1
  export DOMAIN ENVIRONMENT CERT_DIR SUMURAI_ENTRYPOINT_TEST
  . "${ENTRYPOINT}"
}

make_self_signed_certificate() {
  cert_dir="$1"
  days="$2"
  mkdir -p "${cert_dir}"
  openssl req -x509 -nodes -newkey rsa:2048 -days "${days}" \
    -keyout "${cert_dir}/privkey.pem" \
    -out "${cert_dir}/fullchain.pem" \
    -subj "/CN=app.example.com" >/dev/null 2>&1
}

make_ca_signed_certificate() {
  cert_dir="$1"
  days="$2"
  ca_dir="${TMP_DIR}/ca-${days}"
  mkdir -p "${cert_dir}" "${ca_dir}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "${ca_dir}/ca.key" \
    -out "${ca_dir}/ca.pem" \
    -subj "/CN=Test CA ${days}" >/dev/null 2>&1
  openssl req -nodes -newkey rsa:2048 \
    -keyout "${cert_dir}/privkey.pem" \
    -out "${ca_dir}/leaf.csr" \
    -subj "/CN=app.example.com" >/dev/null 2>&1
  openssl x509 -req -in "${ca_dir}/leaf.csr" \
    -CA "${ca_dir}/ca.pem" \
    -CAkey "${ca_dir}/ca.key" \
    -CAcreateserial \
    -days "${days}" \
    -out "${cert_dir}/fullchain.pem" >/dev/null 2>&1
}

development_missing_dir="${TMP_DIR}/development-missing"
load_entrypoint localhost development "${development_missing_dir}"
assert_success validate_tls_certificate
assert_success test -s "${development_missing_dir}/fullchain.pem"
assert_success test -s "${development_missing_dir}/privkey.pem"
assert_success certificate_is_self_signed
assert_failure certificate_expires_within_days 14

development_expiring_dir="${TMP_DIR}/development-expiring"
make_self_signed_certificate "${development_expiring_dir}" 1
original_certificate_mtime="$(file_mtime "${development_expiring_dir}/fullchain.pem")"
sleep 1
load_entrypoint localhost development "${development_expiring_dir}"
assert_success validate_tls_certificate
renewed_certificate_mtime="$(file_mtime "${development_expiring_dir}/fullchain.pem")"
if [ "${renewed_certificate_mtime}" -le "${original_certificate_mtime}" ]; then
  printf 'expected development self-signed certificate to be regenerated\n' >&2
  exit 1
fi
assert_failure certificate_expires_within_days 14

production_missing_dir="${TMP_DIR}/production-missing"
load_entrypoint app.example.com production "${production_missing_dir}"
assert_failure validate_tls_certificate

production_self_signed_dir="${TMP_DIR}/production-self-signed"
make_self_signed_certificate "${production_self_signed_dir}" 30
load_entrypoint app.example.com production "${production_self_signed_dir}"
assert_failure validate_tls_certificate

production_short_lived_dir="${TMP_DIR}/production-short-lived"
make_ca_signed_certificate "${production_short_lived_dir}" 1
load_entrypoint app.example.com production "${production_short_lived_dir}"
assert_failure validate_tls_certificate

production_long_lived_dir="${TMP_DIR}/production-long-lived"
make_ca_signed_certificate "${production_long_lived_dir}" 30
load_entrypoint app.example.com production "${production_long_lived_dir}"
assert_success validate_tls_certificate
