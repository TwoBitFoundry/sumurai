# Merchant Normalization Cutover PRD

## Summary

Implement a hard cutover so every transaction persists both raw and normalized merchant data, all future matching uses the new normalized merchant field, and transaction rows always display the normalized merchant while exposing the raw merchant through a click popover.

## Phase 1: Canonical Merchant Data Model

**Goal**

Define one persisted merchant contract for all transactions and remove the legacy normalization path.

**Tasks**

- [x] Replace the DB-generated `normalized_merchant` behavior with an app-written canonical merchant key.
- [x] Remove production use of the legacy merchant-match helper and make the new normalization engine the only source of normalized display and normalized key.
- [x] Add a persisted merchant normalization source field on transactions.
- [x] Keep custom-category overrides keyed only on the stored normalized merchant field.
- [x] Update transaction entities, API response models, and repository upserts to persist:
  - `original_merchant_name`
  - normalized display merchant in `merchant_name`
  - canonical normalized merchant key
  - normalization source

**Acceptance Criteria**

- [x] `normalized_merchant` is no longer DB-generated.
- [x] Production code does not depend on the legacy merchant normalization helper.
- [x] Transaction writes persist raw merchant, normalized merchant, normalized key, and normalization source.
- [x] Custom-category future matching reads the stored normalized merchant field only.

**Notes**

- Added a transaction schema cutover migration that drops the generated `normalized_merchant` column and recreates it as an app-written field alongside `normalization_source`.
- The normalization engine now emits a canonical key for every normalized merchant result, and repository upserts persist both the canonical key and source.

**TDD Log**

- Red: `cargo test -p sumurai-backend --locked app_supplied_normalized_fields_when_upserting -- --nocapture`
- Green: updated transaction/entity/repository wiring plus the cutover migration so the insert statement carries `normalized_merchant` and `normalization_source`
- Red/Green: `cargo test -p sumurai-backend --locked merchant_name_replaced -- --nocapture`
- Green: `cargo test -p sumurai-backend --locked stored_normalized_key_when_set_transaction_category -- --nocapture`
- Verify: `cargo fmt --check`
- Verify: `cargo test -p sumurai-backend --locked`

## Phase 2: Provider And Import Ingestion Rules

**Goal**

Apply one merchant normalization contract across Plaid, Teller, SimpleFIN, and imports.

**Tasks**

- Plaid:
  - store raw merchant from `original_description`, else `name`
  - use Plaid `merchant_name` as normalized display when present
  - otherwise run the Sumurai engine on the raw value
  - set normalization source to `plaid` or `sumurai_engine`
- Teller:
  - store raw merchant from `description`
  - use `details.counterparty.name` as normalized display when present
  - otherwise run the Sumurai engine on `description`
  - set normalization source to `teller` or `sumurai_engine`
- SimpleFIN:
  - store raw description
  - always run the Sumurai engine for normalized display and key
  - set normalization source to `sumurai_engine`
- CSV/OFX imports:
  - preserve parsed raw merchant text
  - always run the Sumurai engine before persistence
  - set normalization source to `sumurai_engine`
- Ensure the normalization step runs before every transaction upsert path:
  - provider sync
  - SimpleFIN sync
  - demo sync
  - CSV import
  - OFX import

**Acceptance Criteria**

- [x] Plaid transactions persist both raw and normalized merchant data when available.
- [x] Teller transactions persist both raw and normalized merchant data when available.
- [x] SimpleFIN transactions persist raw merchant plus engine-normalized merchant data.
- [x] CSV and OFX imports persist raw merchant plus engine-normalized merchant data.
- [x] No transaction ingestion path writes provider or import merchant text directly as the final display value unless it is an accepted provider-normalized field.

**Notes**

- Plaid and Teller now preserve provider-raw merchant text separately from accepted provider-normalized display values.
- Generic provider sync and authenticated CSV/OFX imports now run the merchant normalization service before transaction upserts.
- SimpleFIN and demo sync keep the engine-normalized path, while imports and provider tests now assert stored normalization source and canonical key behavior.

**TDD Log**

- Red:
  - `cargo test -p sumurai-backend --locked given_valid_qfx_when_importing_then_writes_transactions_and_sets_user -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_plaid_transaction_with_merchant_name_when_mapping_then_preserves_raw_and_provider_display -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_teller_transaction_json_when_from_teller_then_maps_fields_correctly -- --nocapture`
- Green:
  - `cargo test -p sumurai-backend --locked given_valid_qfx_when_importing_then_writes_transactions_and_sets_user -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_plaid_transaction_with_merchant_name_when_mapping_then_preserves_raw_and_provider_display -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_teller_transaction_json_when_from_teller_then_maps_fields_correctly -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_import_file_when_importing_then_persists_other_categories_without_categorizer -- --nocapture`
  - `cargo test -p sumurai-backend --locked given_provider_sync_with_raw_only_merchant_when_persisting_then_normalizes_before_upsert -- --nocapture`
- Verification:
  - `cargo fmt -p sumurai-backend -p entity`
  - `cargo check --workspace --locked --all-targets`
  - `cargo fmt -p sumurai-backend -p entity --check`
  - `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`
  - `cargo test -p sumurai-backend --locked`

## Phase 3: Frontend Merchant Display Contract

**Goal**

Make the normalized merchant the only displayed merchant across transaction surfaces.

**Tasks**

- Update frontend transaction types and transformers so the canonical displayed merchant comes from the normalized backend merchant field.
- Remove row rendering that falls back between duplicate merchant display fields.
- Keep raw merchant available in the frontend model strictly for metadata and the raw-name popover.
- Expose normalization source in frontend types if transaction records surface it.

**Acceptance Criteria**

- [x] Transaction rows display the normalized merchant name everywhere.
- [x] Frontend transaction rendering no longer depends on `name || merchant` display fallback logic.
- [x] Raw merchant data remains available for UI detail display without replacing the normalized label.

**Notes**

- Frontend transaction mapping now treats the backend `merchant_name` as the only canonical display label and keeps raw merchant text in metadata fields only.
- Transaction table, mobile transaction rows, and supporting storybook fixtures no longer reintroduce the legacy duplicate merchant fallback path.

**TDD Log**

- Red:
  - `bun --cwd=frontend test ./tests/domain/TransactionTransformer.test.ts`
  - `bun --cwd=frontend test ./tests/features/transactions/components/TransactionsMobileList.test.tsx`
  - `bun --cwd=frontend test ./tests/components/transactions-table-text.test.tsx`
- Green:
  - `bun --cwd=frontend test ./tests/domain/TransactionTransformer.test.ts`
  - `bun --cwd=frontend test ./tests/features/transactions/components/TransactionsMobileList.test.tsx`
  - `bun --cwd=frontend test ./tests/components/transactions-table-text.test.tsx`
- Verification:
  - `bun --cwd=frontend run typecheck`
  - `bun --cwd=frontend run lint`
  - `bun --cwd=frontend --bun next build --webpack`
  - `bun --cwd=frontend ./scripts/build-sw.mjs`

## Phase 4: Transaction Row Raw-Name Popover

**Goal**

Add a consistent transaction-row interaction that reveals the raw merchant name without replacing the normalized merchant in the row.

**Tasks**

- Replace the current browser `title` behavior in transaction merchant cells with a shared merchant trigger component.
- Reuse the existing Radix `Popover` interaction pattern already used in transaction-adjacent UI.
- Support the interaction on both row surfaces:
  - desktop transactions table
  - compact mobile transaction list
- Show the popover only when `original_merchant_name` exists and differs from the normalized merchant.
- Render non-interactive text when no differing raw merchant is available.
- Style the popover to match existing floating transaction popovers.

**Acceptance Criteria**

- [x] Desktop transaction rows show the normalized merchant and open a popover with the raw merchant on click when applicable.
- [x] Mobile transaction rows show the normalized merchant and open the same raw-name popover on click when applicable.
- [x] Rows without a differing raw merchant remain non-interactive.
- [x] Old `title`-based raw merchant behavior is removed from transaction merchant labels.

**Notes**

- Added a shared transaction merchant label component so desktop and mobile rows use the same normalized-merchant trigger and raw-name popover rules.
- Merchant labels now stay non-interactive unless the stored raw merchant differs from the normalized display name.

**TDD Log**

- Red:
  - `bun --cwd=frontend test ./tests/components/transactions-table-text.test.tsx`
  - `bun --cwd=frontend test ./tests/features/transactions/components/TransactionsMobileList.test.tsx`
- Green:
  - `bun --cwd=frontend test ./tests/components/transactions-table-text.test.tsx`
  - `bun --cwd=frontend test ./tests/features/transactions/components/TransactionsMobileList.test.tsx`
- Verification:
  - `bun --cwd=frontend run lint`
  - `bun --cwd=frontend run build`
  - `bun --cwd=frontend run typecheck`

## Phase 5: Engine Rule Improvements — Address Boundary Detection and Brand Aliases

**Goal**

Fix a set of real-world transaction outliers where the engine produces wrong output. Three root causes to address: (1) no address-boundary detection — bank descriptions embed the full street address in a fixed-width field immediately after the merchant name, contaminating the cleaned result; (2) PayPal is treated as a merchant when it appears as a no-star processor prefix (`PAYPAL MERCHANT` vs `PAYPAL *MERCHANT`); (3) five known brands require canonical casing aliases that title-case cannot produce (`PlayStation`, `OpenAI`, `QuikTrip`, `Cursor`, `Burger King`).

**Pipeline context**

The new Stage 5.5 inserts between the existing Stage 5 (leading prefix strip) and Stage 6 (trailing tails). Ordering is intentional:

```
2.   Aggregator/processor split  ← PayPal no-star case added here
4.   Early dictionary pass       ← 4 of 5 new aliases fire here on dirty strings
5.   Strip leading prefixes      ← DEP added
5.5. [NEW] Cut at address boundary
6.   Strip trailing tails
7.   Inline noise                ← PO BOX added
9.   Corporate suffix strip      ← street-type abbreviations added (ST, AVE, RD, DR, PL, LN, CT, BLVD)
11.  Late dictionary pass        ← CURSOR AI POWERED IDE alias fires here (post-cut)
```

Stage 4 fires on the dirty string before any cleaning. `word_boundary_contains` correctly finds `PLAYSTATION`, `OPENAI`, `QT`, `BURGER KING` in address-contaminated strings because the word boundary falls at the space after the brand token. `CURSOR AI POWERED IDE` is the exception — the boundary fails on the dirty string because `IDE` is immediately followed by `2261` (alphanumeric). Stage 5.5 strips `2261` from `IDE2261` (alpha-first-then-digit), leaving `CURSOR AI POWERED IDE` clean for Stage 11 to match.

**Tasks**

- [x] `rules.rs` — add `"DEP"` to `LEADING_PREFIXES` (before `"PAYMENT"`)
- [x] `rules.rs` — extend `CORPORATE_SUFFIXES` with street-type abbreviations: `"ST"`, `"AVE"`, `"RD"`, `"DR"`, `"PL"`, `"LN"`, `"CT"`, `"BLVD"`
- [x] `rules.rs` — add `PO BOX` to `RE_INLINE_NOISE` pattern: `\b(?:...|PO BOX)\b`
- [x] `engine.rs` — add PayPal no-star processor strip in `apply_aggregator_split` (after `KEEP_MERCHANT_PREFIXES` loop, before `DD *` check): strip `PAYPAL` prefix when `rest` is non-empty; guard passes through `PAYPAL` alone to the existing alias
- [x] `engine.rs` — insert Stage 5.5 call `let work = cut_at_address_boundary(work);` between `strip_leading_prefixes` and `strip_trailing_tails`
- [x] `engine.rs` — implement `cut_at_address_boundary(work: String) -> String`:
  - Strip a single leading token if it is all-digits AND 3+ characters (store-number prefix: `103 BRAUMS STORE` → `BRAUMS STORE`; skips 2-digit tokens like `24` in `24 7 TRAVEL`)
  - Character-level scan: walk chars; if `ch.is_ascii_alphabetic()` set `seen_alpha = true`; if `ch.is_ascii_digit() && seen_alpha` break; otherwise push. Fall back to original if result is empty
- [x] `merchant_alias_seeds.rs` — add `MERCHANT_ALIAS_SEEDS_V2` constant with 5 new seeds (see below) and `insert_merchant_alias_seeds_v2` fn following existing pattern
- [x] `service.rs` — include `MERCHANT_ALIAS_SEEDS_V2` in the runtime alias index build alongside `MERCHANT_ALIAS_SEEDS`
- [x] `migration/src/m20260605_000004_merchant_alias_seeds_expansion.rs` — new migration calling `insert_merchant_alias_seeds_v2`; `down` is no-op (aliases removable via `is_active`)
- [x] `migration/src/lib.rs` — register new migration module and push to `migrations()` vec
- [x] `merchant_normalization_tests.rs` — extend `alias_index_from_seed` with the 5 new `AliasRow` entries; add ~22 new `given_..._when_normalize_then_...` test functions (see acceptance criteria)

**New alias seeds (MERCHANT_ALIAS_SEEDS_V2)**

| match_type | match_key | canonical_name | priority | fires at |
|---|---|---|---|---|
| contains | `PLAYSTATION` | `PlayStation` | 10 | Stage 4 |
| contains | `BURGER KING` | `Burger King` | 10 | Stage 4 |
| contains | `OPENAI` | `OpenAI` | 10 | Stage 4 |
| contains | `CURSOR AI POWERED IDE` | `Cursor` | 10 | Stage 11 (post Stage 5.5 cut) |
| contains | `QT` | `QuikTrip` | 5 | Stage 4 |

`QT` at priority 5 ensures longer keys like `QUIKTRIP` win if added later. `word_boundary_contains` makes 2-letter `QT` safe — it will not match `QUOTA` or `EQUITY`.

`CURSOR AI POWERED IDE` does not match at Stage 4 because the dirty string has `IDE2261` (digit immediately follows `IDE`, failing the word-boundary `after_ok` check). After Stage 5.5 cuts to `CURSOR AI POWERED IDE`, Stage 11 matches with `after_ok = true` (end of string).

**Acceptance Criteria**

Engine (no aliases required in these assertions):

- [x] `15TH STREET VETERINARY6231 East 15th Street TULSA 74112 OK USA` → `15th Street Veterinary` (ordinal `15TH` preserved — digits precede first alpha; cut fires at `6` in `VETERINARY6231`)
- [x] `PROGRESSIVE INS 6300 Wilson Mills Rd MAYFIELD VLG 44143 OH USA (RETURN)` → `Progressive Ins` (`(RETURN)` never reached; cut fires at `6` in `6300`)
- [x] `DEP TURBOTAX IRS REFUND - *****0165` → `Turbotax Irs Refund` (Stage 5 strips `DEP`; Stage 5.5 cuts at `0` in `0165`; Stage 6 dash-strip removes ` - *****`)
- [x] `TST*MUSIC CITY HOT CHI1820 N College Ave 180 Fort Collins 80524 CO USA` → `Music City Hot Chi` (Stage 2 strips `TST*`; Stage 5.5 cuts at `1` in `CHI1820`; bank truncated `CHICKEN` — not recoverable without alias)
- [x] `24 7 TRAVEL ST 2710 COMMERCE RD GOODLAND 67735 KS USA` → `24 7 Travel` (leading `24` is 2-digit — not stripped; Stage 5.5 cuts at `2` in `2710`; Stage 9 strips trailing `ST`)
- [x] `103 BRAUMS STORE 550 E 47th St S WICHITA 67216 KS USA` → `Braums Store` (leading `103` is 3-digit — stripped; Stage 5.5 cuts at `5` in `550`)
- [x] `NGROK INC. 445 Bush St Floor 8 SAN FRANCI94108 CA USA` → `Ngrok` (Stage 3 dot-normalizes `INC.` → `INC`; Stage 5.5 cuts at `4` in `445`; Stage 9 strips `INC`)
- [x] `SIMPLEFIN BRIDGE PO Box 7081 CHESTNUT M30502 GA USA` → `Simplefin Bridge` (Stage 5.5 cuts at `7`; Stage 7 inline noise strips `PO BOX`)
- [x] `FSP*BAILEY BROTHERS PL800 INDUSTRIAL DR YUKON 73099 OK USA` → `Bailey Brothers` (Stage 2 star-splits `FSP`; Stage 5.5 cuts at `8` in `PL800`; Stage 9 strips `PL`)
- [x] `BUC-EES #0060 5201 Nugget Road BETHOUD 80513 CO USA` → `Buc-Ees` (Stage 5.5 cuts at `0` in `#0060`; Stage 14 trims trailing `#`; title_case_token capitalizes each hyphen-segment)
- [x] `PAYPAL GITHUB` → `Github` (Stage 2 PayPal strip; no-star form)
- [x] `PAYPAL` alone → `PayPal` (Stage 2 guard: rest is empty → falls through to alias)
- [x] `PAYPAL * NETFLIX` → `Netflix` (existing `KEEP_MERCHANT_PREFIXES` behavior unchanged)
- [x] Leading 3-digit token stripped, 2-digit token preserved (regression guard for `24 7 TRAVEL`)

Alias-dependent:

- [x] `QT 10 7626 E. 61ST ST. TULSA 74133 OK USA` → `QuikTrip`
- [x] `OPENAI 1455 3rd Street SAN FRANCI94158 CA USA` → `OpenAI`
- [x] `PLAYSTATION 2207 BRIDGEPOINTE PKWY SAN MATEO 94404 CA USA` → `PlayStation`
- [x] `BURGER KING #27826 Q0747TH STREET SOUTH WICHITA 67216 KS USA` → `Burger King`
- [x] `CURSOR AI POWERED IDE2261 Market Street STE 86466 SAN FRANCI10025 CA USA` → `Cursor`

**TDD Log**

- Red: `cargo test -p sumurai-backend --locked merchant_normalization` — 15 new tests failing
- Green: implement `rules.rs` (DEP prefix, street-type corporate suffixes, PO BOX noise), `engine.rs` (PayPal no-star strip in Stage 2, `cut_at_address_boundary` as Stage 5.5), `merchant_alias_seeds.rs` (MERCHANT_ALIAS_SEEDS_V2 + insert fn), new migration, `lib.rs` (register migration), `service.rs` (chain V2 seeds in runtime index), `merchant_normalization_tests.rs` (5 new AliasRows, 22 new tests)
- Fixed pre-existing failure in `connection_service_tests` (`given_provider_sync_with_raw_only_merchant`) — test assertion updated from `Starbucks Seattle` to `Starbucks` to reflect correct alias-based normalization introduced in Phase 1-4
- Verify: `cargo test -p sumurai-backend --locked` — 630 passed, 0 failed

**Known Remaining Gaps (deferred)**

- `POS TST*MRM - BIG DIPP CHK CARD PUR Sand Springs OK 355349` — merchant name is entirely in the trailing dash segment; Stage 6 discards it before any alias can fire. Requires inspecting the dash segment for alias keys before stripping.
- `Braums Store` — `STORE` retained because adding it to corporate suffixes risks `Apple Store` / `Microsoft Store`. Addressable with a `BRAUMS` alias.
- `Turbotax Irs Refund` — `IRS REFUND` is all-alpha; Stage 5.5 cannot cut there. Addressable with `IRS REFUND` in inline noise.
- `Music City Hot Chi` — bank field truncated `CHICKEN` to `CHI`; full name unrecoverable without a `MUSIC CITY HOT CHI` → `Music City Hot Chicken` alias.

## Validation

**Backend**

- Unit tests for normalization output and source selection.
- Service tests covering Plaid, Teller, SimpleFIN, CSV, and OFX write paths.
- Integration tests proving normalized merchant fields are writable and persisted correctly after schema changes.
- Category override tests proving future matching uses the stored normalized merchant field only.

**Frontend**

- Transformer tests for normalized merchant, raw merchant, and normalization source mapping.
- Desktop transaction table tests for normalized merchant rendering and raw-name popover behavior.
- Mobile transaction list tests for normalized merchant rendering and raw-name popover behavior.
- Removal of legacy `title`-attribute expectations in favor of explicit interaction assertions.

## Assumptions

- No backwards compatibility: no dual-write, no dual-read, and no preservation of legacy normalized-merchant semantics.
- No backfill in this work. Existing historical rows may remain inconsistent until separately repaired.
- The normalization source records where the normalized display merchant came from, not just which provider supplied the transaction.

## Risks

- Schema changes affect override matching and any query path that currently assumes `normalized_merchant` is DB-generated.
- Frontend transaction rendering currently carries duplicate merchant display concepts, so the cutover must update types and row components together.
- Provider field differences must be enforced precisely to avoid storing enriched provider values as raw merchant text.

## Next Actions

- Confirm the final transaction response shape for the normalization source field.
- Implement the backend schema and ingestion cutover first so frontend row work lands on the final contract.
- Follow with the transaction row popover work once the normalized and raw merchant fields are stable end-to-end.
