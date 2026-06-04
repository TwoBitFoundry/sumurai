# Merchant Normalization Engine — Phased Plan

## Context

Bank/provider transaction descriptions arrive as noisy strings — payment-channel prefixes
(`POS`, `DEBIT`, `CHK CARD PUR`), store numbers (`#12`), card masks (`*****04463`),
city/state suffixes (`TULSA OK`), trailing reference codes, and aggregator markers
(`INSTACART*ALDI`). Today every ingestion path (`Transaction::from_teller/from_plaid`,
SimpleFIN `map_transaction`, CSV/OFX import) runs only `normalize_merchant_display_case()` —
a pure title-caser — so the user sees `Pos Costco Whse #12 Pos Purchase Tulsa Ok 537252`
instead of `Costco`.

Goal: a **robust, rule-based engine** that produces a clean display name while **preserving
the original raw string**. Pattern: **clean (strip generic noise) → match (canonical alias
dictionary) → fallback (smart title-case)**.

### Decisions (locked)

- Original raw string preserved in a new `transactions.original_merchant_name` column,
  surfaced as a **row tooltip** in the UI.
- Canonical alias dictionary is **DB-backed** (`merchant_aliases` table), cached in memory.
- Applied to **new/synced transactions only** — no historical backfill.

### Separation of concerns

- **Generic cleaning rules live in code** (regex/const — not merchant-specific).
- **Merchant-specific canonical names live in the DB** (editable without redeploy).

### Engine pipeline (stages 0–14)

Strict ordered pipeline; each stage consumes the previous stage's output. Principle: **match
the dictionary as early as possible, run destructive cleaning only on what's left** so brands
with digits/punctuation/state-like tokens survive. Returns
`NormalizedMerchant { display, canonical_key, source, confidence }`.

| # | Stage | Rule | Example |
|---|-------|------|---------|
| 0 | Unicode preprocess | NFKC, fold diacritics for match copy, collapse whitespace/zero-width, uppercase `work`, trim | `Café  Du   Monde` → `CAFE DU MONDE` |
| 1 | Source-aware path | Enriched provider field (Teller `counterparty.name`, Plaid `merchant_name`) → light path: skip destructive stages 5–10 | `Costco` (enriched) → untouched |
| 2 | Processor/aggregator split | `mode` table. KeepAggregator: `INSTACART*`,`GRUBHUB*`,`UBER EATS`. KeepMerchant: `SQ *`,`TST*`,`TOAST*`,`PAYPAL *`,`PY *`,`SP *`,`WPY*`,`CLOVER`,`STRIPE`,`IZ *`,`AMZN MKTP`,`GOOGLE *`,`APLPAY`,`EB *`. `DD *<text>`→DoorDash; `DD <payroll/ACH>`→structural | `SQ *BLUE BOTTLE` → `BLUE BOTTLE` · `INSTACART*ALDI` → `INSTACART` |
| 3 | URL/punctuation normalize | Strip `WWW.`,`HTTP(S)://`, trailing `.COM/.NET/.ORG`; normalize quotes/apostrophes; keep `&`,`-`,`'`; leave `#` for stage 7 | `WWW.NETFLIX.COM` → `NETFLIX` |
| 4 | Early dictionary pass (protective) | **Word-boundary** `contains` + `exact` on lightly-cleaned `work` **before** digit/geo destruction. Protects `7-ELEVEN`,`5 GUYS`,`T-MOBILE`,`1-800-FLOWERS`,`H-E-B`. Hit → return | `7-ELEVEN 35420` → `7-Eleven` |
| 5 | Leading payment prefixes | Loop-strip const list: `POS`,`DEBIT`,`CREDIT`,`ACH( DEBIT\| CREDIT)?`,`EFT`,`WEB`,`MOBILE`,`RECUR(RING)?`,`PIN( PUR(CHASE)?)?`,`PURCHASE`,`PRE-?AUTH(ORIZED)?`,`CHK CARD PUR`,`CHECKCARD`,`CARD PURCHASE`,`WITHDRAWAL`,`ONLINE`,`ELECTRONIC`,`VISA`,`MASTERCARD`,`DCARD`,`SIG`,`BILL ?PAY`,`AUTOPAY`,`PMT`,`PAYMENT` | `POS COSTCO WHSE #12 …` → `COSTCO WHSE #12 …` |
| 6 | Trailing tails & codes | Cut from first ` - `; strip card masks `[*xX]{2,}\d+` / `\d{0,2}\*+\d+`; phone numbers; trailing alnum auth codes (≥6 mixed) and digit runs ≥3; right-to-left, stop at first alpha token | `… - *****04463` · `… - 2W92KF73ZBQ5BNO` removed |
| 7 | Inline channel noise | Remove `#\d+`/`STORE \d+`, mid-string `POS PURCHASE`/`CHK CARD PUR`/`CPPWDRAWAL`/`POS`/`PURCHASE`/`DEBIT`, standalone `NA`/`N.A.`, `US`/`USA`, dates `\d{2}/\d{2}` | `COSTCO WHSE #12 POS PURCHASE` → `COSTCO WHSE` |
| 8 | Geographic suffix (guarded) | Strip trailing `CITY ST`/`CITYST` only when `ST`∈state-set AND final token(s) AND (trailing ref/digit followed OR city precedes) AND ≥1 token remains. Handles `OK`/`IN`/`OR` word collisions | `COSTCO WHSE TULSA OK 537` → `COSTCO WHSE` |
| 9 | Corporate suffix strip | Remove trailing `LLC/INC/CORP/CO/LTD/LLP/PLLC/THE` | `TESLA MOTORS INC` → `TESLA MOTORS` |
| 10 | Collapse repeats | Dedup adjacent repeated tokens / repeated word-prefixes | `TESLA MOTORS TESLA MOTO` → `TESLA MOTORS` |
| 11 | Canonical lookup (DB) | Word-boundary `contains` (tie-break priority desc, then longest match) then `exact` on `match_key`; returns stored `canonical_name` verbatim | `WINCO FOODS` → `WinCo` · `CITY OF TULSA TULSA UTIL` → `City of Tulsa` |
| 12 | Structural fallback | `ATM …`→`ATM Withdrawal`, `CHECK \d+`→`Check #NNNN`, `INTEREST\|DIVIDEND`→`Interest`, `FEE\|SERVICE CHARGE`→`Bank Fee`, `ZELLE\|VENMO\|CASH ?APP`→brand, transfer/payroll/direct-deposit → `Transfer`/`Payroll` | `ATM WITHDRAWAL 0034` → `ATM Withdrawal` |
| 13 | Title-case fallback | Title-case; lowercase small words (`of/and/the/&/at/for/to`); preserve acronyms (all-caps ≤4 chars or all-consonant stay upper) | `AMER ELECT PWR` → `Amer Elect Pwr` · `BP TULSA` → `BP` |
| 14 | Finalize | Trim stray punctuation; cap length (~64); empty → title-cased `original` (never blank). Idempotency invariant | `BOKF, ` → `BOKF` |

---

## Phase 1 — Schema & dependencies

**Goal:** Persist the raw string, stand up the DB-backed alias dictionary with a seed set, and
add the crates the engine needs.

**Tasks**
- Add deps to `backend/Cargo.toml`: `regex`, `once_cell`, `unicode-normalization`; upgrade to
  latest with built-in tooling after adding.
- New migration in `backend/migration/src/` (follow `m20260528_000001_init.rs` style):
  `merchant_aliases` table — `id uuid pk`, `match_type text` (`'exact'|'contains'`),
  `match_key text`, `canonical_name text`, `priority int default 0`,
  `is_active bool default true`, `created_at`, `updated_at`; index on `(is_active, match_type)`.
- Seed `merchant_aliases` in the same migration with the known gotchas (`COSTCO WHSE`→Costco,
  `WINCO`→WinCo, `BOKF`→BOKF, `INSTACART`→Instacart, `TESLA MOTORS`→Tesla Motors,
  `CITY OF TULSA`→City of Tulsa) plus a starter set of common US merchants.
- New migration adds `transactions.original_merchant_name varchar` (nullable). Leave the
  generated `normalized_merchant` column untouched.

**Acceptance criteria**
- [ ] `regex`, `once_cell`, `unicode-normalization` present and at latest; `cargo build` clean.
- [ ] Migrations apply cleanly on a dev DB (forward-only).
- [ ] `merchant_aliases` exists, is indexed, and seed rows are present.
- [ ] `transactions.original_merchant_name` column exists and is nullable.

---

## Phase 2 — Core engine (pure, DB-free) + tests

**Goal:** Implement the stage 0–14 pipeline as pure logic, fully unit-tested against the
gotchas and edge cases.

**Tasks**
- New module `backend/src/services/merchant_normalization/`:
  - `types.rs` — `NormalizedMerchant { display, canonical_key, source, confidence }`;
    `MatchSource = Enriched|Aggregator|EarlyContains|EarlyExact|Contains|Exact|Structural|Fallback`;
    `MerchantSource = Enriched|Raw`; `AliasIndex` (HashMap exact + Vec contains).
  - `rules.rs` — const lists (prefixes, channel noise, corporate suffixes, US-state set,
    small-words, acronym rules, aggregator `mode` table) + anchored `once_cell::Lazy<Regex>`
    (card masks, phone numbers, auth codes, store numbers, geo suffix, dates, structural).
  - `engine.rs` — `normalize(raw, src, index) -> NormalizedMerchant` implementing stages 0–14;
    reuse `normalize_merchant_display_case` for title-case; never-blank + idempotency guards.
  - `mod.rs` — exports.
- Fix `utils/merchant_name.rs::normalize_merchant_for_match` to keep ASCII **alphanumerics**
  and fold diacritics; keep the engine's match-key independent of the DB generated column
  (document the divergence in code/PR).
- `backend/src/tests/merchant_normalization_tests.rs` — table-driven, given/when/then naming,
  in-memory `AliasIndex` from the seed set (no DB). Cover all 7 gotchas + robustness fixtures
  (early protective lookup, KeepMerchant/aggregator, DD disambiguation, URL strip, acronym,
  `ELECTRICITYWORKS` no-false-positive, structural labels, diacritics, idempotency, never-blank,
  enriched light path).

**Acceptance criteria**
- [ ] All 7 user gotchas produce the documented outputs.
- [ ] Robustness fixtures pass (digit-brands, word-boundary, acronyms, structural, diacritics).
- [ ] Idempotency holds: every expected output fed back through `normalize` is unchanged.
- [ ] Never-blank holds: pure-noise input falls back to the raw, not `""`.
- [ ] `cargo test -p sumurai-backend --locked merchant_normalization` passes; `cargo clippy` clean.

---

## Phase 3 — Service layer & alias index caching

**Goal:** Wrap the engine in a stateless service that loads and caches the alias dictionary.

**Tasks**
- `service.rs` — `MerchantNormalizationService { db: Arc<dyn DatabaseRepository>, cache: Arc<dyn CacheService> }`
  (stateless, like `AutoCategorizationService`).
- `async fn alias_index(&self) -> Arc<AliasIndex>` — load active aliases, Redis-cached with TTL,
  built into HashMap (exact) + Vec sorted `(priority desc, len desc)` (contains).
- `async fn normalize_batch(&self, txns: &mut [Transaction])` — apply the engine per row using
  the loaded index; set `merchant_name` from `original_merchant_name`, populate `source`/`confidence`.
- Register in `services/mod.rs`; add a repository read for `merchant_aliases`.

**Acceptance criteria**
- [ ] Service compiles and is exported from `services/mod.rs`.
- [ ] Alias index is loaded once per batch and cache-backed (TTL respected; cache miss rebuilds).
- [ ] `normalize_batch` test: `merchant_name` replaced, `original_merchant_name` preserved,
      `source`/`confidence` populated.

---

## Phase 4 — Ingestion integration & API surface

**Goal:** Preserve the raw string at every ingestion path, run the engine in the service layer,
and expose the new field through the API.

**Tasks**
- `models/transaction.rs`: add `original_merchant_name: Option<String>` to `Transaction` and
  `TransactionWithAccount`. In `from_teller`/`from_plaid`/SimpleFIN `map_transaction`/
  `from_csv_row`/`from_ofx` set `original_merchant_name` = chosen raw source (untouched) and keep
  `merchant_name = normalize_merchant_display_case(raw)` as the pre-engine fallback.
- `services/connection_service.rs` sync path: after dedup, before upsert (~line 957) call
  `normalize_batch(&mut txns)`.
- `services/import_service.rs` (CSV/OFX): same `normalize_batch` call before persisting.
- Wire `MerchantNormalizationService` into the services where they are constructed
  (main.rs/app wiring).
- `repository_service.rs` `get_transactions_paginated`: select/return `original_merchant_name`;
  persist it on upsert.
- Regenerate OpenAPI (`backend/openapi/`, `docs/OPENAPI.json`).

**Acceptance criteria**
- [ ] Each ingestion constructor sets `original_merchant_name` to the untouched raw source.
- [ ] Sync and CSV/OFX import both run `normalize_batch` before persistence.
- [ ] `/api/transactions` returns `original_merchant_name` and a normalized `merchant_name`.
- [ ] OpenAPI regenerated; `cargo build`/`clippy` clean; backend test suite green.

---

## Phase 5 — Frontend tooltip

**Goal:** Display the normalized name and surface the original raw string on hover.

**Tasks**
- `frontend/src/types/api.ts` + `domain/TransactionTransformer.ts`: add optional
  `original_merchant_name`; map to `Transaction.originalName?`.
- `features/transactions/components/TransactionsTable.tsx` (~line 255) and
  `TransactionsMobileList.tsx` (~line 113): add `title={originalName}` on the merchant cell.
- Extend an existing `TransactionsTable` test to assert the tooltip `title` attribute.

**Acceptance criteria**
- [ ] Transaction list shows the normalized `merchant_name`.
- [ ] Hovering a merchant cell shows the raw `original_merchant_name`.
- [ ] `bun --cwd=frontend test -- TransactionsTable` passes.

---

## Phase 6 — Verification

**Goal:** Prove the feature end-to-end.

**Tasks / Acceptance criteria**
- [ ] `cargo test -p sumurai-backend --locked merchant_normalization` — all gotcha fixtures pass.
- [ ] `cargo build` / `cargo clippy` clean.
- [ ] Migrations applied on dev DB; `merchant_aliases` seeded and `original_merchant_name` present.
- [ ] Sync a connection (or CSV import); `/api/transactions` shows clean `merchant_name` and raw
      `original_merchant_name`.
- [ ] `bun --cwd=frontend test -- TransactionsTable` passes; tooltip verified at
      `http://localhost:8080` (`:3001` bypasses the proxy — do not validate there).

---

## Assumptions

- Provider constructors can distinguish enriched vs raw sources (they already pick a source
  before title-casing), enabling the stage-1 light path.
- The generated `normalized_merchant` column stays alpha-only; the engine's in-memory match-key
  is intentionally independent (keeps digits) to avoid a schema change.
- Seed dictionary is a starter set; coverage grows via DB rows without redeploy.

## Risks & mitigations

- **Over-stripping brand-significant digits/punctuation** → mitigated by the stage-4 early
  protective dictionary lookup before destructive cleaning.
- **Geo/state-word collisions** (`OK`/`IN`/`OR`) → guarded suffix rule (position + non-empty
  remainder requirements).
- **`contains` false positives** → word-boundary matching, not naive substring.
- **Sync latency** → alias index loaded once per batch and cached; lookups are in-memory.
- **Catastrophic regex backtracking** → all regexes anchored and linear.

## Out of scope / future

- No backfill of historical rows; they normalize on next re-sync.
- Fuzzy/typo matching (`strsim`) and an admin UI to edit `merchant_aliases`.
- Generic word-segmentation for glued multi-word brands (`WALMARTSUPERCENTER`) — relies on a
  dictionary `contains` entry in v1.

## Next actions

1. Implement Phase 1 (deps + migrations + seed).
2. Implement Phase 2 (engine + tests) using strict TDD against the fixture table above.
3. Proceed Phase 3 → 6 in order, verifying after each.
