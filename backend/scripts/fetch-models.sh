#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
model_dir="${MODEL_DIR:-$script_dir/../assets/models/all-MiniLM-L6-v2}"
revision=751bff37182d3f1213fa05d7196b954e230abad9
model_quantized_sha256=afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1
tokenizer_sha256=da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0
config_sha256=7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7
base_url="https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/$revision"

verify_checksum() {
  local sha256=$1
  local path=$2
  if [[ "$(uname -s)" == Darwin ]]; then
    printf '%s  %s\n' "$sha256" "$path" | shasum -a 256 -c >/dev/null 2>&1
  else
    printf '%s  %s\n' "$sha256" "$path" | sha256sum -c >/dev/null 2>&1
  fi
}

download() {
  local url=$1
  local path=$2
  local sha256=$3
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]] && verify_checksum "$sha256" "$path"; then
    return
  fi
  tmp=$(mktemp)
  curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "$url" -o "$tmp"
  verify_checksum "$sha256" "$tmp"
  mv "$tmp" "$path"
}

download "$base_url/onnx/model_quantized.onnx" "$model_dir/model_quantized.onnx" "$model_quantized_sha256"
download "$base_url/tokenizer.json" "$model_dir/tokenizer.json" "$tokenizer_sha256"
download "$base_url/config.json" "$model_dir/config.json" "$config_sha256"
