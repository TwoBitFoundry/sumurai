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

- [ ] Desktop transaction rows show the normalized merchant and open a popover with the raw merchant on click when applicable.
- [ ] Mobile transaction rows show the normalized merchant and open the same raw-name popover on click when applicable.
- [ ] Rows without a differing raw merchant remain non-interactive.
- [ ] Old `title`-based raw merchant behavior is removed from transaction merchant labels.

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
