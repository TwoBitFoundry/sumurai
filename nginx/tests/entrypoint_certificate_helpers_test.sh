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

load_entrypoint() {
  unset FULLCHAIN
  unset PRIVKEY
  CERT_DIR="$1" SUMURAI_ENTRYPOINT_TEST=1 . "${ENTRYPOINT}"
}

make_self_signed_certificate() {
  cert_dir="$1"
  days="$2"
  mkdir -p "${cert_dir}"
  openssl req -x509 -nodes -newkey rsa:2048 -days "${days}" \
    -keyout "${cert_dir}/privkey.pem" \
    -out "${cert_dir}/fullchain.pem" \
    -subj "/CN=localhost" >/dev/null 2>&1
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

missing_dir="${TMP_DIR}/missing"
load_entrypoint "${missing_dir}"
assert_failure certificate_exists

self_signed_dir="${TMP_DIR}/self-signed"
make_self_signed_certificate "${self_signed_dir}" 30
load_entrypoint "${self_signed_dir}"
assert_success certificate_exists
assert_success certificate_is_self_signed
assert_failure certificate_expires_within_days 14

short_lived_dir="${TMP_DIR}/short-lived"
make_ca_signed_certificate "${short_lived_dir}" 1
load_entrypoint "${short_lived_dir}"
assert_success certificate_exists
assert_failure certificate_is_self_signed
assert_success certificate_expires_within_days 14

long_lived_dir="${TMP_DIR}/long-lived"
make_ca_signed_certificate "${long_lived_dir}" 30
load_entrypoint "${long_lived_dir}"
assert_success certificate_exists
assert_failure certificate_is_self_signed
assert_failure certificate_expires_within_days 14
