#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
model_dir="$script_dir/../assets/models/distilbert-us-transaction-classifier-v2"
revision=2bbf6764c314a43449912cdd15480b922a05e140
model_quantized_sha256=1ab2b64277921566be0303003473fac0bb6b65b21dd7db74548575410eecc5c6
tokenizer_sha256=d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66
config_sha256=23cf01ac65701eb3d4603f7c2aac7714e8209db0d72e011a768e2e085ec7f56e
label_mapping_sha256=39c222d5f9394e8e41e3d545f360236c1ab0757b6a8e50c637529129b867febf
base_url="https://huggingface.co/DoDataThings/distilbert-us-transaction-classifier-v2/resolve/$revision"

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
download "$base_url/label_mapping.json" "$model_dir/label_mapping.json" "$label_mapping_sha256"
