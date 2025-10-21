#!/bin/bash

# Build backend binary for x86_64 Linux using cross-compilation
# This script uses the cross tool for Docker-based cross-compilation

set -e

echo "🔨 Cross-compiling Rust backend for x86_64 Linux..."

# Navigate to the repo root
cd "$(dirname "$0")/.."

# Check if cross is installed
if ! command -v cross &> /dev/null; then
    echo "❌ cross tool not found. Please install it first:"
    echo "   cargo install cross --git https://github.com/cross-rs/cross"
    exit 1
fi

# Pre-pull Seq image so docker compose builds have it cached locally
SEQ_IMAGE="datalust/seq:2025.2"
if command -v docker &> /dev/null; then
    if docker image inspect "$SEQ_IMAGE" > /dev/null 2>&1; then
        echo "♻️  Seq image already cached ($SEQ_IMAGE)"
    else
        echo "⬇️  Pulling Seq image ($SEQ_IMAGE)..."
        docker pull "$SEQ_IMAGE"
    fi
else
    echo "⚠️  Docker CLI not available; skipping Seq image pre-pull"
fi

# Cross-compile only the backend crate for x86_64 Linux
cross build --manifest-path backend/Cargo.toml \
  --target x86_64-unknown-linux-gnu --release

echo "✅ Backend cross-compiled successfully!"
echo "📁 Binary location: backend/target/x86_64-unknown-linux-gnu/release/accounting-backend"
echo "🚀 Ready for Docker deployment (~5 seconds)"
