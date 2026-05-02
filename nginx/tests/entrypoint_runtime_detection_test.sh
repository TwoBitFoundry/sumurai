#!/bin/sh
set -eu

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
ENTRYPOINT="${REPO_ROOT}/nginx/entrypoint.sh"

run_runtime_mode() {
  env "$@" SUMURAI_ENTRYPOINT_TEST=1 sh -c '. "$1"; runtime_mode' sh "$ENTRYPOINT"
}

assert_runtime_mode() {
  expected="$1"
  shift
  actual="$(run_runtime_mode "$@")"
  if [ "${actual}" != "${expected}" ]; then
    printf 'expected %s, got %s\n' "${expected}" "${actual}" >&2
    exit 1
  fi
}

assert_runtime_mode development DOMAIN=localhost
assert_runtime_mode development DOMAIN=127.0.0.1
assert_runtime_mode development DOMAIN=
assert_runtime_mode production DOMAIN=app.example.com
assert_runtime_mode production DOMAIN=localhost ENVIRONMENT=production
