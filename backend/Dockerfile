FROM rust:1.95-slim-trixie AS chef
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev ca-certificates curl postgresql-client && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --version 0.1.77 --locked

FROM chef AS sqlx-cli
RUN cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features rustls,postgres

FROM chef AS assets
ARG ONNXRUNTIME_VERSION=1.24.4
ARG MODEL_REVISION=751bff37182d3f1213fa05d7196b954e230abad9
ARG MODEL_QUANTIZED_SHA256=afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1
ARG TOKENIZER_SHA256=da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0
ARG CONFIG_SHA256=7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7
RUN set -eu; \
    mkdir -p /tmp/onnxruntime /app/assets/models/all-MiniLM-L6-v2; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://github.com/microsoft/onnxruntime/releases/download/v${ONNXRUNTIME_VERSION}/onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}.tgz" -o /tmp/onnxruntime.tgz; \
    tar -xzf /tmp/onnxruntime.tgz -C /tmp/onnxruntime; \
    cp -a /tmp/onnxruntime/onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}/lib/libonnxruntime.so* /usr/local/lib/; \
    ldconfig; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${MODEL_REVISION}/onnx/model_quantized.onnx" -o /app/assets/models/all-MiniLM-L6-v2/model_quantized.onnx; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${MODEL_REVISION}/tokenizer.json" -o /app/assets/models/all-MiniLM-L6-v2/tokenizer.json; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 30 --max-time 300 "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${MODEL_REVISION}/config.json" -o /app/assets/models/all-MiniLM-L6-v2/config.json; \
    printf '%s  %s\n' "$MODEL_QUANTIZED_SHA256" /app/assets/models/all-MiniLM-L6-v2/model_quantized.onnx | sha256sum -c >/dev/null 2>&1; \
    printf '%s  %s\n' "$TOKENIZER_SHA256" /app/assets/models/all-MiniLM-L6-v2/tokenizer.json | sha256sum -c >/dev/null 2>&1; \
    printf '%s  %s\n' "$CONFIG_SHA256" /app/assets/models/all-MiniLM-L6-v2/config.json | sha256sum -c >/dev/null 2>&1; \
    rm -rf /tmp/onnxruntime /tmp/onnxruntime.tgz

FROM chef AS planner
COPY backend/ ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/backend/recipe.json ./recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY backend/ ./
RUN cargo build --release --locked

FROM debian:trixie-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl postgresql-client libssl3 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY --from=sqlx-cli /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx
COPY --from=assets /usr/local/lib/libonnxruntime.so* /usr/local/lib/
RUN ldconfig
COPY --from=assets /app/assets/models/all-MiniLM-L6-v2 /app/assets/models/all-MiniLM-L6-v2
ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so
ENV MODEL_DIR=/app/assets/models/all-MiniLM-L6-v2
COPY --from=builder /app/backend/target/release/sumurai-backend /app/sumurai-backend
COPY backend/migrations /app/migrations
EXPOSE 3000
CMD ["./sumurai-backend"]
