# ML Transaction Categorization — Backend Rust `ort`, Manual-Import Only

> **Handoff note for the implementing agent.** Work the phases below in order. Each phase has a **Goal**, **Tasks**, and **Acceptance Criteria** you must satisfy before moving on. Follow strict TDD per the `phase-implementer` skill (red → green → refactor) and boundary-only testing per `sumurai-testing-policy`. Tests live in `backend/src/tests/` only — never inline. Do **not** touch provider-sync code or add schema migrations.

---

## Context

Manually imported transactions (CSV / OFX / QBO / QFX / QBX) all land in the database with `category_primary = "OTHER"` ([backend/src/models/transaction.rs:358, :431](backend/src/models/transaction.rs)). Categories are not editable post-import, so every manual import becomes a wall of uncategorized rows — the largest categorization gap in the product. Plaid and Teller already supply categories via `personal_finance_category` and the Teller→PFC map in `normalize_teller_category` ([backend/src/models/transaction.rs:629](backend/src/models/transaction.rs)); those paths are **out of scope**.

We will predict a Plaid-PFC primary category for each manually imported row using an INT8-quantized sentence-embedding model (`all-MiniLM-L6-v2`) running **inside the existing Docker container** via the Rust `ort` crate (full ONNX Runtime build for Linux). Inference happens in `POST /transactions/import` between parsing and `upsert_transactions_batch`:

1. embed each parsed row's description,
2. cosine-compare against pre-computed category embeddings held in memory,
3. set `category_primary` + `category_confidence` from the winner when confidence clears a threshold; otherwise leave the existing `"OTHER"` default.

The `.onnx` model file is portable to a future native-mobile (ORT Mobile) or browser-PWA (`onnxruntime-web`) runtime — the model is shared across all ONNX Runtime variants; only the runtime build differs per environment. No pgvector. No embedding persistence. No frontend changes.

---

## Model assets — where to download

We use Xenova's quantized export of `sentence-transformers/all-MiniLM-L6-v2` from Hugging Face. Pinned to `main` revision (capture a commit SHA when implementing — see Phase 1).

| File | Source URL |
|---|---|
| `model_quantized.onnx` (~22 MB, INT8) | `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx` |
| `tokenizer.json` (~700 KB) | `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json` |
| `config.json` (small) | `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json` |

Files are downloaded at **Docker build time** and during local dev via `backend/scripts/fetch-models.sh`. They are **not** committed to the repo (`.gitignore` entry covers them). Checksums are pinned in both the script and the Dockerfile — the implementing agent must:
1. Download the files once locally.
2. Run `sha256sum model_quantized.onnx tokenizer.json config.json`.
3. Paste the resulting hex digests into the script and Dockerfile as the canonical pinned values.
4. Also pin the Hugging Face revision by replacing `main` in the URLs with the resolved commit SHA from `https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2` (`sha` field). This is the **single source of truth** for both fetch paths.

Local dev destination: `backend/assets/models/all-MiniLM-L6-v2/`
Container destination: `/app/assets/models/all-MiniLM-L6-v2/` (already used as the working directory pattern by the existing Dockerfile — match it).

---

## Phases

### Phase 1 — Foundations: deps, model fetch, Docker

**Goal.** Make the model assets + ONNX Runtime available to the build and the container, without touching any app behavior yet.

**Tasks.**
1. Add to `backend/Cargo.toml`:
   - `ort = { version = "2", default-features = false, features = ["load-dynamic", "ndarray"] }`
   - `tokenizers = { version = "0", default-features = false, features = ["onig"] }`
   - `ndarray`
   After adding, run `cargo update -p ort -p tokenizers -p ndarray` and confirm we land on the newest released versions (per project policy to upgrade after adding packages).
2. Create `backend/scripts/fetch-models.sh`:
   - `#!/usr/bin/env bash` + `set -euo pipefail`.
   - Downloads the three files listed above into `backend/assets/models/all-MiniLM-L6-v2/`.
   - Verifies each file via `sha256sum -c` against pinned digests embedded in the script.
   - Idempotent: skips downloads when files exist and checksums match.
   - Make it executable: `chmod +x`.
3. Add to `backend/.gitignore`: `assets/models/`.
4. Update `backend/Dockerfile`:
   - In a builder stage (or existing build stage), install the ONNX Runtime shared library for Linux x86_64 (download `onnxruntime-linux-x64-*.tgz` from the official `microsoft/onnxruntime` GitHub release matching the `ort` crate's expected ABI; pin to a specific release tag in the Dockerfile).
   - Copy `libonnxruntime.so.*` into `/usr/local/lib/` in the final image and run `ldconfig`.
   - In the same or a separate stage, run the equivalent of `fetch-models.sh` to place the model files at `/app/assets/models/all-MiniLM-L6-v2/`.
   - Set `ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so` and `ENV MODEL_DIR=/app/assets/models/all-MiniLM-L6-v2`.
5. Update `CONTRIBUTING.md`: a brief subsection under setup pointing dev users at `./backend/scripts/fetch-models.sh` and noting it must run before the first `cargo build`.

**Acceptance criteria.**
- [x] `./backend/scripts/fetch-models.sh` populates the assets directory; rerunning is a no-op.
- [x] `sha256sum` of each downloaded file matches the digest pinned in the script and Dockerfile (digests are identical between the two).
- [x] `cargo build --manifest-path backend/Cargo.toml --locked` succeeds on a clean checkout after running the fetch script.
- [x] `docker build` succeeds; running the resulting image starts the backend normally (no behavior change yet).
- [x] `assets/models/` is git-ignored; the model files do not appear in `git status`.

**TDD log.**
- `backend/scripts/fetch-models.sh` validated twice for idempotence after adding portable checksum verification.
- `cargo build --manifest-path backend/Cargo.toml --locked` passed after adding `api-24` to `ort`.
- `docker build --progress=plain -f backend/Dockerfile -t sumurai-backend-phase1 .` passed.
- `docker run --rm --entrypoint sh sumurai-backend-phase1 -lc 'test -f /app/assets/models/all-MiniLM-L6-v2/model_quantized.onnx && test -f /app/assets/models/all-MiniLM-L6-v2/tokenizer.json && test -f /app/assets/models/all-MiniLM-L6-v2/config.json && test -f /usr/local/lib/libonnxruntime.so && echo ok'` passed.

---

### Phase 2 — Models & category descriptors

**Goal.** Add the small in-memory data types and the category-descriptor table. Pure additions; no behavior change.

**Tasks.**
1. Create `backend/src/models/predicted_category.rs`:
   - `pub struct PredictedCategory { pub primary: String, pub confidence: Confidence }`
   - `pub enum Confidence { High, Medium, Low }` with helper `pub fn as_str(&self) -> &'static str` returning `"HIGH" | "MEDIUM" | "LOW"` to match Plaid's `category_confidence` strings already in use ([backend/src/models/transaction.rs:594](backend/src/models/transaction.rs)).
2. Re-export from `backend/src/models/mod.rs`.
3. Create directory `backend/src/services/categorization/` and add `mod.rs` plus `category_descriptors.rs`:
   - `pub const PFC_CATEGORY_DESCRIPTORS: &[(&str, &str)]` — exactly one entry per primary category. Union of categories produced by `normalize_teller_category` and Plaid PFC. Cover: `TRAVEL`, `FOOD_AND_DRINK`, `SHOPPING`, `GENERAL_MERCHANDISE`, `ENTERTAINMENT`, `MEDICAL`, `TRANSPORTATION`, `RENT_AND_UTILITIES`, `LOAN_PAYMENTS`, `INCOME`, `TRANSFER_IN`, `TRANSFER_OUT`, `GOVERNMENT_AND_NON_PROFIT`, `HOME_IMPROVEMENT`, `GENERAL_SERVICES`, `PERSONAL_CARE`, `BANK_FEES`.
   - Each descriptor is a short concrete sentence enumerating typical merchants/contexts. Example: `("FOOD_AND_DRINK", "Restaurants, cafes, bars, groceries, food delivery, dining out.")`, `("TRANSPORTATION", "Gas, fuel, parking, public transit, ride share, tolls, car services.")`.
4. Re-export `categorization` module from `backend/src/services/mod.rs`.

**Acceptance criteria.**
- [x] `cargo check --manifest-path backend/Cargo.toml --locked` passes.
- [x] `PFC_CATEGORY_DESCRIPTORS` contains every category string that `normalize_teller_category` in [backend/src/models/transaction.rs:629](backend/src/models/transaction.rs) currently returns, plus the Plaid PFC primaries that appear elsewhere. (Cross-checked by a unit test in `backend/src/tests/category_descriptor_coverage.rs` that asserts a hardcoded expected set matches the descriptor keys.)
- [x] `Confidence::as_str()` returns exactly `"HIGH" | "MEDIUM" | "LOW"`.

**TDD log.**
- Red: `cargo test --manifest-path backend/Cargo.toml --locked category_descriptor_coverage` failed until the new model and service modules existed.
- Green: added `backend/src/models/predicted_category.rs`, `backend/src/services/categorization/mod.rs`, and `backend/src/services/categorization/category_descriptors.rs`, then reran `cargo test --manifest-path backend/Cargo.toml --locked category_descriptor_coverage`.
- Refactor/verify: `cargo check --manifest-path backend/Cargo.toml --locked` passed after silencing placeholder dead-code warnings.

---

### Phase 3 — `CategorizationService` (TDD: threshold logic first, then real model)

**Goal.** Build the service in red→green→refactor order. Threshold and cosine logic land first under stub embeddings, then the runtime model-loading path is added behind the service boundary.

**Tasks.**

*Red — write failing tests first:*

1. `backend/src/tests/categorization_service_threshold_tests.rs`:
   - Build a `CategorizationService` via a test-only constructor `CategorizationService::from_refs(category_refs: Vec<(String, Vec<f32>)>)` that bypasses the model.
   - Drive `categorize_batch_sync(...)` (a sync inner that the async public method wraps) with stub query vectors.
   - Cases:
     - Clear winner (similarity ≈ 0.9, margin >> 0.04) → `Confidence::High`.
     - Mid match (sim ≈ 0.45, clear margin) → `Confidence::Medium`.
     - Low match (sim ≈ 0.32, clear margin) → `Confidence::Low`.
     - Below floor (sim < 0.30) → fallback `OTHER` + `Low`.
     - Tight margin (top1 − top2 < 0.04) → fallback `OTHER` + `Low`.
     - Empty input → empty output.

*Green — implement minimum to pass:*

2. Create `backend/src/services/categorization/categorization_service.rs`:
   - `pub struct CategorizationService { session: Option<ort::Session>, tokenizer: Option<tokenizers::Tokenizer>, category_refs: Vec<(String, Vec<f32>)> }`
   - `pub fn from_refs(...)` test-only constructor.
   - `fn cosine_and_threshold(query: &[f32], refs: &[(String, Vec<f32>)]) -> PredictedCategory` implementing the rules: floor `0.30`, margin `0.04`, tiers `0.55`/`0.40`.
   - L2-normalize helper.
3. `pub async fn new(model_dir: &Path) -> Result<Self>`:
   - Wraps loading in `tokio::task::spawn_blocking` (per `async-network-operations-architecture`).
   - Loads `model_quantized.onnx` into an `ort::Session`.
   - Loads `tokenizer.json` via `tokenizers::Tokenizer::from_file`.
   - Runs the model once on each `PFC_CATEGORY_DESCRIPTORS` entry, mean-pools over the attention-masked token outputs, L2-normalizes, stores in `category_refs`.
4. `pub async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>>`:
   - Empty input shortcut.
   - Tokenize with padding + truncation to the model's max seq len (read from `config.json`, falling back to 128).
   - `spawn_blocking` ORT run on the batch.
   - Mean-pool with attention mask, L2-normalize each row.
   - Per row, call `cosine_and_threshold`.
5. Trait extraction for testability: define
   ```rust
   #[async_trait]
   pub trait Categorizer: Send + Sync {
       async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>>;
   }
   ```
   Implement for `CategorizationService`. Handler will hold `Arc<dyn Categorizer>`.

**Acceptance criteria.**
- [x] `cargo test --manifest-path backend/Cargo.toml --locked categorization_service_threshold` passes.
- [x] All ORT and tokenizer work executes inside `spawn_blocking` (verifiable by grep — no direct `session.run` on the async runtime thread).
- [x] Reference embeddings: every category vector has L2 norm within `1e-3` of `1.0`.
- [x] `Categorizer` trait exists; `CategorizationService` implements it.

**TDD log.**
- Red: added `backend/src/tests/categorization_service_threshold_tests.rs` to pin floor, margin, and confidence-band behavior before the service existed.
- Green: implemented `backend/src/services/categorization/categorization_service.rs` with stub scoring, model loading, tokenization, and embedding normalization.
- Refactor/verify: `cargo test --manifest-path backend/Cargo.toml --locked categorization_service_threshold` passed; `cargo check --manifest-path backend/Cargo.toml --locked` still reports unused-item warnings until the handler wiring lands in the next phase.

---

### Phase 4 — Wire into the manual-import handler

**Goal.** Thread the categorizer through `AppState` and apply predictions in `POST /transactions/import` only.

**Tasks.**
1. Construct `Arc<CategorizationService>` once during startup in `backend/src/main.rs`. On error, abort startup with a clear log line (fail-fast, per `performance-cost-architecture`).
2. Add it to the existing `AppState` (mirror how `repository_service` and `cache_service` are wired today). Store it as `Arc<dyn Categorizer + Send + Sync>` to keep the handler test-substitutable.
3. Modify `import_authenticated_transactions` (handler at [backend/src/main.rs:1306](backend/src/main.rs)):
   - After `ImportService::parse_csv` / `parse_ofx` returns the `Vec<Transaction>`, collect `(idx, description)` for rows where `category_primary == "OTHER"`.
   - Call `categorizer.categorize_batch(descriptions).await`.
   - For each result with `confidence != Confidence::Low`, overlay `category_primary` and `category_confidence` onto the row at that index. Rows with `Low` confidence retain `"OTHER"`.
   - On `Err(_)` from the categorizer: log a warning with the request id and proceed with the original `"OTHER"` rows. **The import must not fail because categorization failed.**
   - Then proceed to the existing `upsert_transactions_batch` call at ~main.rs:1374. No control flow changes for the happy path.
4. `backend/src/tests/import_handler_categorization_tests.rs`:
   - Build the handler against a `StubCategorizer` (also lives in the test file) returning deterministic predictions per description.
   - Assert: rows whose stub prediction is `Medium`/`High` are persisted with that primary + confidence; rows the stub returns as `Low` retain `"OTHER"`; categorizer returning `Err` still persists with `"OTHER"` and does not fail the request.
   - Use the existing test helpers / fixtures for an import multipart request (look in `backend/src/tests/` for the import-related test pattern already in use and reuse it).

**Acceptance criteria.**
- [ ] `cargo test --manifest-path backend/Cargo.toml --locked import_handler_categorization` passes.
- [ ] Pre-existing import tests pass: `cargo test --manifest-path backend/Cargo.toml --locked import`.
- [ ] No edits to `connection_service.rs`, `sync_service.rs`, `providers/`, or any migration files (`grep -L` to confirm in your PR).
- [ ] No new endpoints, no changes to `frontend/`.
- [ ] Handler logs categorization timing (e.g., `info!(rows = N, elapsed_ms = …, "import categorization")`) so the verification step can read it.

---

### Phase 5 — End-to-end verification

**Goal.** Confirm the pipeline works in the running stack and behaves resiliently.

**Tasks.**
1. `./backend/scripts/fetch-models.sh` then start the full stack via the project's existing dev script (per `AGENTS.md` / `CONTRIBUTING.md`). Visit `http://localhost:8080` (per CLAUDE.md — **not** `:3001`).
2. Prepare a small CSV fixture with these descriptions: `WHOLE FOODS MARKET #123`, `SHELL OIL 5512`, `NETFLIX.COM`, `PG&E WEB ONLINE`, `PAYMENT 1234`.
3. Import via the UI; verify in `TransactionsTable` that the first four show `FOOD_AND_DRINK`, `TRANSPORTATION`, `ENTERTAINMENT`, `RENT_AND_UTILITIES` and the last shows `OTHER`.
4. Prepare a 500-row CSV (can be repeats of the above); import it and confirm the handler's `import categorization` log line shows `elapsed_ms ≤ 3000` on a typical container CPU.
5. Resilience: rename or truncate the model file inside the container and restart → backend startup aborts with a clear, actionable error.
6. Regression: trigger a Plaid (or Teller, depending on local creds) provider sync and confirm Plaid-supplied categories are unchanged (no ML overlay on provider-sync rows).

**Acceptance criteria.**
- [ ] Five-row fixture categorizes as listed above.
- [ ] 500-row import: categorization stage ≤ 3 s on a typical container CPU (read from log line).
- [ ] Corrupted/missing model file ⇒ fail-fast at startup with a clear log line.
- [ ] Provider sync continues to use Plaid/Teller categories unchanged.
- [ ] Manual import remains usable end-to-end if the categorizer returns `Err` (verified by temporarily forcing an error path in dev — categorization failures degrade gracefully).

---

## Critical files (summary, for orientation)

**New:**
- `backend/scripts/fetch-models.sh`
- `backend/src/models/predicted_category.rs`
- `backend/src/services/categorization/mod.rs`
- `backend/src/services/categorization/category_descriptors.rs`
- `backend/src/services/categorization/categorization_service.rs`
- `backend/src/tests/categorization_service_threshold_tests.rs`
- `backend/src/tests/categorization_service_real_model_tests.rs`
- `backend/src/tests/category_descriptor_coverage.rs`
- `backend/src/tests/import_handler_categorization_tests.rs`

**Modified:**
- `backend/Cargo.toml`
- `backend/Dockerfile`
- `backend/.gitignore`
- `backend/src/main.rs` (startup wiring + `import_authenticated_transactions` at ~1306)
- `backend/src/services/mod.rs`
- `backend/src/models/mod.rs`
- `CONTRIBUTING.md`

## Out of scope (deferred)

- Running ML on Plaid/Teller provider sync.
- Persisting per-transaction embeddings or installing pgvector.
- Browser / PWA / native-mobile inference — the `.onnx` file is portable; runtime swap can come later.
- A "low confidence — review me" UI queue.
- User-editable categories post-import.
