FROM rust:1.95-slim-trixie AS chef
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev ca-certificates curl postgresql-client && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --version 0.1.77 --locked

FROM chef AS planner
COPY backend/ ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/backend/recipe.json ./recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY backend/ ./
RUN cargo build --release --locked
RUN cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features rustls,postgres

FROM debian:trixie-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl postgresql-client libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx
COPY --from=builder /app/backend/target/release/sumurai-backend /app/sumurai-backend
COPY backend/migrations /app/migrations
EXPOSE 3000
CMD ["./sumurai-backend"]
