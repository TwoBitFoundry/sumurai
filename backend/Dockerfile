FROM rust:1.95-slim-trixie AS chef
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev ca-certificates curl postgresql-client && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --version 0.1.77 --locked

FROM chef AS assets
ARG TARGETARCH
ARG ONNXRUNTIME_VERSION=1.24.4
ARG MODEL_REVISION=2bbf6764c314a43449912cdd15480b922a05e140
ARG MODEL_QUANTIZED_SHA256=1ab2b64277921566be0303003473fac0bb6b65b21dd7db74548575410eecc5c6
ARG TOKENIZER_SHA256=d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66
ARG CONFIG_SHA256=23cf01ac65701eb3d4603f7c2aac7714e8209db0d72e011a768e2e085ec7f56e
ARG LABEL_MAPPING_SHA256=39c222d5f9394e8e41e3d545f360236c1ab0757b6a8e50c637529129b867febf
RUN set -eu; \
    case "${TARGETARCH}" in \
        amd64) ORT_ARCH="x64" ;; \
        arm64) ORT_ARCH="aarch64" ;; \
        *) echo "Unsupported ONNX Runtime architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    mkdir -p /tmp/onnxruntime /app/backend/assets/models/distilbert-us-transaction-classifier-v2; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://github.com/microsoft/onnxruntime/releases/download/v${ONNXRUNTIME_VERSION}/onnxruntime-linux-${ORT_ARCH}-${ONNXRUNTIME_VERSION}.tgz" -o /tmp/onnxruntime.tgz; \
    tar -xzf /tmp/onnxruntime.tgz -C /tmp/onnxruntime; \
    cp -a /tmp/onnxruntime/onnxruntime-linux-${ORT_ARCH}-${ONNXRUNTIME_VERSION}/lib/libonnxruntime.so* /usr/local/lib/; \
    ldconfig; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/DoDataThings/distilbert-us-transaction-classifier-v2/resolve/${MODEL_REVISION}/onnx/model_quantized.onnx" -o /app/backend/assets/models/distilbert-us-transaction-classifier-v2/model_quantized.onnx; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/DoDataThings/distilbert-us-transaction-classifier-v2/resolve/${MODEL_REVISION}/tokenizer.json" -o /app/backend/assets/models/distilbert-us-transaction-classifier-v2/tokenizer.json; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/DoDataThings/distilbert-us-transaction-classifier-v2/resolve/${MODEL_REVISION}/config.json" -o /app/backend/assets/models/distilbert-us-transaction-classifier-v2/config.json; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/DoDataThings/distilbert-us-transaction-classifier-v2/resolve/${MODEL_REVISION}/label_mapping.json" -o /app/backend/assets/models/distilbert-us-transaction-classifier-v2/label_mapping.json; \
    printf '%s  %s\n' "$MODEL_QUANTIZED_SHA256" /app/backend/assets/models/distilbert-us-transaction-classifier-v2/model_quantized.onnx | sha256sum -c >/dev/null 2>&1; \
    printf '%s  %s\n' "$TOKENIZER_SHA256" /app/backend/assets/models/distilbert-us-transaction-classifier-v2/tokenizer.json | sha256sum -c >/dev/null 2>&1; \
    printf '%s  %s\n' "$CONFIG_SHA256" /app/backend/assets/models/distilbert-us-transaction-classifier-v2/config.json | sha256sum -c >/dev/null 2>&1; \
    printf '%s  %s\n' "$LABEL_MAPPING_SHA256" /app/backend/assets/models/distilbert-us-transaction-classifier-v2/label_mapping.json | sha256sum -c >/dev/null 2>&1; \
    rm -rf /tmp/onnxruntime /tmp/onnxruntime.tgz

FROM chef AS planner
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/Cargo.toml
COPY backend/entity/Cargo.toml backend/entity/Cargo.toml
COPY backend/migration/Cargo.toml backend/migration/Cargo.toml
COPY cli/Cargo.toml cli/Cargo.toml
RUN mkdir -p backend/src backend/entity/src backend/migration/src cli/src \
    && printf 'fn main() {}\n' > backend/src/main.rs \
    && printf '\n' > backend/entity/src/lib.rs \
    && printf '\n' > backend/migration/src/lib.rs \
    && printf 'fn main() {}\n' > backend/migration/src/main.rs \
    && printf 'fn main() {}\n' > cli/src/main.rs \
    && printf '\n' > cli/src/lib.rs
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
ARG CARGO_FEATURES=
COPY --from=planner /app/recipe.json ./recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY backend/ ./backend/
COPY cli/ ./cli/
RUN if [ -n "$CARGO_FEATURES" ]; then \
      cargo build --release --locked -p sumurai-backend -p migration -p sumurai-cli --features "$CARGO_FEATURES"; \
    else \
      cargo build --release --locked -p sumurai-backend -p migration -p sumurai-cli; \
    fi

FROM debian:trixie-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg libssl3 libgomp1 \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-15 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=assets /usr/local/lib/libonnxruntime.so* /usr/local/lib/
RUN ldconfig
COPY --from=assets /app/backend/assets/models/distilbert-us-transaction-classifier-v2 /app/backend/assets/models/distilbert-us-transaction-classifier-v2
ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so
COPY --from=builder /app/target/release/sumurai-backend /app/sumurai-backend
COPY --from=builder /app/target/release/migration /app/migration
COPY --from=builder /app/target/release/sumurai /app/sumurai
COPY backend/scripts/docker-migrate.sh /app/docker-migrate.sh
COPY backend/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-migrate.sh /app/docker-entrypoint.sh
EXPOSE 3000
CMD ["/app/docker-entrypoint.sh"]
