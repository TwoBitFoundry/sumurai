#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/certs/teller"
mkdir -p "$dir"
for name in certificate.pem private_key.pem; do
  path="$dir/$name"
  if [[ -d "$path" ]]; then
    rm -rf "$path"
  fi
done
if [[ ! -f "$dir/certificate.pem" || ! -f "$dir/private_key.pem" ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$dir/private_key.pem" \
    -out "$dir/certificate.pem" \
    -days 3650 \
    -subj "/CN=sumurai-local-dev"
fi
