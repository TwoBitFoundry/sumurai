#!/bin/sh
set -eu

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
HEALTHCHECK="${REPO_ROOT}/nginx/healthcheck.sh"
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

make_fake_wget() {
  bin_dir="${TMP_DIR}/bin"
  mkdir -p "${bin_dir}"
  printf '#!/bin/sh\nexit 0\n' > "${bin_dir}/wget"
  chmod +x "${bin_dir}/wget"
  PATH="${bin_dir}:${PATH}"
  export PATH
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

run_healthcheck() {
  domain="$1"
  environment="$2"
  cert_dir="$3"
  env DOMAIN="${domain}" ENVIRONMENT="${environment}" CERT_DIR="${cert_dir}" ENTRYPOINT_PATH="${REPO_ROOT}/nginx/entrypoint.sh" sh "${HEALTHCHECK}"
}

make_fake_wget

missing_dir="${TMP_DIR}/missing"
assert_failure run_healthcheck app.example.com production "${missing_dir}"

self_signed_dir="${TMP_DIR}/self-signed"
make_self_signed_certificate "${self_signed_dir}" 30
assert_failure run_healthcheck app.example.com production "${self_signed_dir}"

short_lived_dir="${TMP_DIR}/short-lived"
make_ca_signed_certificate "${short_lived_dir}" 1
assert_failure run_healthcheck app.example.com production "${short_lived_dir}"

long_lived_dir="${TMP_DIR}/long-lived"
make_ca_signed_certificate "${long_lived_dir}" 30
assert_success run_healthcheck app.example.com production "${long_lived_dir}"
