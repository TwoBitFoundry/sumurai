# Sumurai Docker/Rust Build Redesign Plan

## Summary

Replace the current cross-compiled, prebuilt-binary backend container flow with a Docker-native Rust build. A developer should be able to run `docker compose up --build` and get a backend image built directly from the current Rust source, without running a separate build script or copying a host `target/` binary into the image.

Because this repository is public, published GHCR images are public artifacts. They must not contain secrets, local config, certificates, `.env` contents, or host-generated build artifacts.

## Phase 1: Build Flow Redesign

### Implementation

- Add `backend/Dockerfile` to build `sumurai-backend` inside Docker.
- Use a multi-stage Dockerfile with `cargo-chef`:
  - `chef` stage:
    - Use a Rust base image matching `rust-toolchain.toml`.
    - Set `WORKDIR /app/backend`.
    - Install system build dependencies needed by this crate, including `pkg-config`, `libssl-dev`, `ca-certificates`, and `curl` if dependency builds require them.
    - Install `cargo-chef` with `cargo install cargo-chef --locked`.
  - `planner` stage:
    - Inherit from `chef`.
    - Copy backend files needed for recipe generation.
    - Copying `backend/ ./` is acceptable for the first implementation because `.dockerignore` must exclude `backend/target` and generated artifacts.
    - Run `cargo chef prepare --recipe-path recipe.json`.
  - `builder` stage:
    - Inherit from `chef`.
    - Copy `recipe.json` from `planner`.
    - Run `cargo chef cook --release --locked --recipe-path recipe.json`.
    - Copy `backend/ ./`.
    - Run `cargo build --release --locked`.
    - Produce `/app/backend/target/release/sumurai-backend`.
  - `runtime` stage:
    - Use a slim Debian image compatible with the builder output.
    - Install only runtime dependencies.
    - Copy `/app/backend/target/release/sumurai-backend` to `/app/sumurai-backend`.
    - Copy `backend/migrations` to `/app/migrations`.
    - Set `WORKDIR /app`.
    - Expose port `3000`.
    - Use `CMD ["./sumurai-backend"]`.
- Preserve useful `cargo-chef` cache behavior:
  - Dependency layers should invalidate when dependency metadata changes, primarily `backend/Cargo.toml`, `backend/Cargo.lock`, crate/module structure, or build-script relevant files.
  - Normal Rust source changes should reuse the `cargo chef cook` dependency layer and rerun only the final `cargo build --release --locked`.
  - Host `backend/target` must never enter the Docker build context.
- Install runtime tools needed by the existing backend compose command:
  - `ca-certificates`
  - `curl`
  - PostgreSQL client tooling
  - `sqlx-cli`, or an equivalent way for `sqlx migrate run` to work inside the backend container.
- Update `docker-compose.yml` so the backend service builds from `backend/Dockerfile`.
- Remove backend service reliance on:
  - `backend/Dockerfile.prebuilt`
  - `scripts/build-backend.sh`
  - `backend/target/x86_64-unknown-linux-gnu/...`
  - `cross`
- Add a root `.dockerignore` that excludes generated and sensitive-prone paths:
  - `.git`
  - `.DS_Store`
  - `.env`
  - `.env.*`
  - `backend/target`
  - `frontend/node_modules`
  - `frontend/.next`
  - `frontend/out`
  - `frontend/coverage`
  - `node_modules`
  - Other generated build/cache folders already present in the repo.

### Acceptance Criteria

- `docker compose config` succeeds.
- `docker compose build backend` builds the backend from Rust source inside Docker.
- Docker build output shows a `cargo chef cook --release --locked --recipe-path recipe.json` layer before the final `cargo build --release --locked`.
- Rebuilding after a normal backend source-only change reuses the cargo-chef dependency layer and reruns the final Rust build.
- Changing `backend/Cargo.toml` or `backend/Cargo.lock` invalidates the cargo-chef dependency layer.
- The backend image build does not require `cross`.
- The backend image build does not require `scripts/build-backend.sh`.
- The backend image build does not copy any host `backend/target` binary.
- The backend service in compose no longer references `backend/Dockerfile.prebuilt`.
- A change to backend Rust source causes the backend compile layer to rerun during Docker build.
- `.dockerignore` prevents `backend/target` and `.env` files from entering the Docker build context.
- The existing backend startup behavior remains intact: migrations run before `sumurai-backend` starts.

### Completed

- Added `backend/Dockerfile` with `cargo-chef`, a locked dependency cook step, a final release build, and a slim runtime image.
- Updated `docker-compose.yml` so the backend service builds from `backend/Dockerfile`.
- Added a root `.dockerignore` that excludes generated outputs and secret-prone files from the Docker context.

### TDD Log

- `docker compose --env-file /private/tmp/codex-empty.env config`
- `docker compose --env-file /private/tmp/codex-empty.env --progress=plain build backend`
- Result: compose config succeeded, and the backend image built from Rust source with `cargo chef cook --release --locked --recipe-path recipe.json` before the final `cargo build --release --locked`.

## Phase 2: Local Tooling and Checks

### Implementation

- Add root npm tooling modeled after Archivalist.
- Add root scripts:
  - `rust:lint`: run `cargo fmt --manifest-path backend/Cargo.toml --all --check` and `cargo clippy --manifest-path backend/Cargo.toml --locked --all-targets --no-deps -- -D warnings`.
  - `rust:typecheck`: run `cargo check --manifest-path backend/Cargo.toml --locked --all-targets`.
  - `rust:test`: run `cargo test --manifest-path backend/Cargo.toml --locked`.
  - `precommit`: run `npm run rust:lint && npm run rust:test`.
- Add Husky as a dev dependency.
- Run npm built-in update tooling after adding packages.
- Replace `.husky/pre-commit` with a minimal hook that runs `npm run precommit`.
- Do not run frontend package manager commands from the root hook unless root workspaces are explicitly introduced.

### Acceptance Criteria

- `npm run rust:lint` runs Rust format and clippy checks from the repository root.
- `npm run rust:typecheck` runs Rust type checking from the repository root.
- `npm run rust:test` runs backend tests from the repository root.
- `npm run precommit` runs the intended Rust checks.
- `.husky/pre-commit` delegates to `npm run precommit`.
- The hook no longer depends on `pnpm`.
- No frontend dependency workflow is broken.

### Completed

- Added a root `package.json` with Rust check scripts and a `prepare` hook for Husky.
- Added `husky` as a root dev dependency and updated the lockfile.
- Replaced the pre-commit hook with a minimal root npm delegation.
- Normalized the backend test files so the root lint script passes cleanly.

### TDD Log

- `npm run rust:lint`
- `npm run rust:typecheck`
- `npm run rust:test`
- `npm run precommit`
- `./.husky/pre-commit`
- Result: all root Rust checks passed, the combined precommit script passed, and the hook delegated to the same root script successfully.

## Phase 3: GitHub Actions Alignment

### Implementation

- Update `.github/workflows/ci.yml` to model Archivalist's Rust job structure:
  - Use `ubuntu-24.04`.
  - Use current checkout and Rust setup actions.
  - Install Rust components `rustfmt` and `clippy`.
  - Restore Cargo cache with `Swatinem/rust-cache`.
  - Run `cargo fmt --all --check`.
  - Run `cargo clippy --workspace --locked --all-targets --no-deps -- -D warnings`.
  - Run `cargo test --workspace --locked`.
- Add path filtering so backend CI runs for backend, Rust toolchain, workflow, and Docker backend build changes.
- Keep the frontend job working with the existing `frontend/` project.
- Add or update image publishing workflow only if publishing is part of the deployment target:
  - Publish backend image from `backend/Dockerfile`.
  - Publish frontend image from `frontend/Dockerfile`.
  - Use `ghcr.io/twobitfoundry/sumurai-*` names.
  - Treat published images as public-safe artifacts.
- Ensure image builds never include `.env`, local certificates, or host build output.

### Acceptance Criteria

- CI runs Rust format, clippy, and tests with locked dependencies.
- CI does not use `cross`.
- CI does not use `scripts/build-backend.sh`.
- CI does not rely on `backend/Dockerfile.prebuilt`.
- Backend CI runs when backend source, backend Dockerfile, Cargo files, Rust toolchain, or workflow files change.
- Frontend CI still runs for frontend changes.
- Any image publishing workflow builds images from Dockerfiles, not host-built binaries.
- Public image contents are safe to inspect.

### Completed

- Updated `.github/workflows/ci.yml` to use a path-filter job, Rust fmt/clippy/test steps, and job-level gating for backend and frontend changes.
- Kept the frontend job intact while aligning the backend job to the current Rust toolchain and cache setup.
- Left image publishing untouched because this repository does not currently have a publishing workflow to update.

### TDD Log

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); puts "yaml ok"'`
- Result: the workflow parsed successfully after the CI rewrite.

## Phase 4: Cleanup and Documentation

### Implementation

- Remove obsolete cross-build materials if no active workflow still needs them:
  - `scripts/build-backend.sh`
  - `backend/Dockerfile.prebuilt`
  - `Cross.toml`
- Update documentation that references the old build flow:
  - `AGENTS.md`
  - `README.md`
  - `CONTRIBUTING.md`
  - Any Docker/deployment docs found during implementation.
- Replace old instructions with:
  - `docker compose up --build`
  - `docker compose build backend`
  - Root Rust check scripts where appropriate.
- Keep backend business logic unchanged.

### Acceptance Criteria

- No tracked documentation instructs developers to run `./scripts/build-backend.sh`.
- No tracked documentation describes the backend image as requiring a prebuilt host binary.
- No tracked compose or CI file references `backend/Dockerfile.prebuilt`.
- No tracked compose or CI file references the cross build script.
- Obsolete cross-only files are removed unless another active workflow still needs them.
- Existing unrelated user changes are preserved.

## Final Verification

Run these commands from the repository root:

```bash
docker compose config
docker compose build backend
cargo fmt --manifest-path backend/Cargo.toml --all --check
cargo clippy --manifest-path backend/Cargo.toml --locked --all-targets --no-deps -- -D warnings
cargo test --manifest-path backend/Cargo.toml --locked
npm run precommit
```

Expected result: all commands complete successfully, except for any pre-existing unrelated test failures. Document exact failure output for any failures that are not caused by this implementation.

## Non-Goals

- Do not change backend API behavior.
- Do not refactor Rust services, models, middleware, or route logic.
- Do not migrate frontend structure.
- Do not add secrets, certs, or `.env` values to images.
- Do not make local development depend on pulling GHCR images.
