# Export Accounts & Transactions (CSV / OFX) — Phased Plan

## Summary

Sumurai can **import** transactions (CSV, OFX/QFX/QBO/QBX) but has **no export** path — "Financial reports and data export" is still a `README.md` roadmap item. This adds export on the **Accounts tab**: a **per-institution** button on each `BankCard` and a **top-level** "Export" button in the page header. The user picks **CSV** or **OFX**; the file downloads in the browser.

Confirmed decisions:
- **Formats:** CSV + OFX (mirror the import formats; open in Excel/Quicken/QuickBooks).
- **OFX variant:** OFX 2.x XML (well-formed XML).
- **Content:** accounts + transactions.
- **Scope:** always export all stored data (no date-range picker).

## Core design

- **CSV** — RFC 4180 via the `csv` crate's `Writer` (auto quoting/escaping). One transaction-centric file with denormalized account/institution columns so bank info travels with each row: `Date, Institution, Account, Account Type, Mask, Balance, Description, Amount, Category, Pending, Transaction ID`. Accounts with zero transactions still emit one summary row (empty transaction fields) so no account is lost.
- **OFX 2.x (XML)** — generated with `quick-xml`'s `Writer`. Hand-written header `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` + `<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>`, then `<OFX>` → `<SIGNONMSGSRSV1><SONRS>` (status 0, `DTSERVER`, `LANGUAGE ENG`). Transactions grouped **by account**: depository → `<BANKMSGSRSV1><STMTTRNRS><STMTRS>` with `<BANKACCTFROM>` (`BANKID` placeholder, `ACCTID`=mask/provider id, `ACCTTYPE`=CHECKING/SAVINGS); credit → `<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>` with `<CCACCTFROM>`; loans/investments fall back to a bank statement (CHECKING). Each statement: `<BANKTRANLIST>` (`DTSTART`/`DTEND`) + one `<STMTTRN>` per txn (`TRNTYPE` from amount sign, `DTPOSTED` `YYYYMMDD`, `TRNAMT`, `FITID`=provider_transaction_id or row id, `NAME`/`MEMO`), then `<LEDGERBAL>` (`BALAMT`=current balance, `DTASOF`). `quick-xml` escapes text automatically.
- Output **round-trips** with the existing importer (`ImportService::parse_ofx`, [backend/src/services/import_service.rs:33](../backend/src/services/import_service.rs)) — the importer reads `<STMTTRN>…</STMTTRN>` blocks and leaf tags via `extract_ofx_tag` (stops at next `<`), so XML closing tags don't break it.

Standards: [OFX](https://docs.fileformat.com/finance/ofx/), [OFX standards](https://www.openbankingtracker.com/standards/ofx), [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180).

## Assumptions

- Export data is drawn from the DB (synced), not live provider calls.
- RLS scopes every query by authenticated `user_id`; `connection_id` filtering relies on RLS for ownership.
- Account `account_type` is a free string ("depository", "credit", "loan", "investment", or provider-specific); mapped to OFX statement type as above.
- No existing OFX-writer Rust crate exists (all are parsers) — generation is intentional, validated by the round-trip test.

## Risks

- **Amount-sign / TRNTYPE convention** — must confirm the app's sign convention so CREDIT vs DEBIT matches what the importer would re-ingest. Verify against `Transaction::from_ofx`.
- **`ApiClient` blob support** — must route through the existing retry/auth-refresh path, not bypass it (project guardrail).
- **OFX `BANKID`** — required by spec; we emit a stable placeholder since the provider data has no routing number. Confirm target finance apps tolerate it.
- **Large exports** — current handlers return full payloads (no streaming); acceptable for now, revisit if datasets grow.

---

## Phase 1 — Backend export models & service

**Goal:** Pure, unit-testable serialization of accounts + transactions into CSV and OFX 2.x XML.

**Tasks:**
- Add `quick-xml` to [backend/Cargo.toml](../backend/Cargo.toml); upgrade to latest after adding (`cargo update -p quick-xml`).
- Create `backend/src/models/export.rs`: `ExportFormat` enum (`Csv`, `Ofx`) with serde rename + `ToSchema`; `ExportQuery { format, connection_id: Option<Uuid> }`; helpers for filename (`sumurai-export-YYYYMMDD.{csv,ofx}`) and content-type (`text/csv`, `application/x-ofx`).
- Create `backend/src/services/export_service.rs`: `ExportService::to_csv(accounts, txns) -> String` (via `csv::Writer`) and `to_ofx(accounts, txns) -> String` (hand-written PI header + element tree via `quick-xml::Writer`, grouping txns by account into bank vs credit statements).
- Register the new module in `models/mod.rs` and `services/mod.rs`.

**Acceptance criteria:**
- [x] `quick-xml` is in `Cargo.toml` at its latest version and the project builds.
- [x] `ExportService::to_csv` emits the documented header + one row per transaction, plus a summary row for zero-transaction accounts.
- [x] `ExportService::to_ofx` emits well-formed OFX 2.x XML routing depository vs credit accounts correctly, with auto-escaped text.
- [x] Both functions are pure (operate on passed-in data, no I/O).

TDD log:
- Added `backend/src/tests/export_service_tests.rs` and `backend/src/tests/export_model_tests.rs` first, then implemented `backend/src/models/export.rs` and `backend/src/services/export_service.rs`.
- `cargo test -p sumurai-backend --locked export_service_tests`
- `cargo test -p sumurai-backend --locked export`
- `cargo check -p sumurai-backend --locked`

---

## Phase 2 — Backend repository, handler & routing

**Goal:** Expose `GET /api/export` returning a downloadable file, RLS-scoped, optionally filtered by institution.

**Tasks:**
- Add `get_transactions_for_export(user_id, account_ids: Option<&[Uuid]>)` to [backend/src/services/repository_service.rs](../backend/src/services/repository_service.rs) — all `TransactionWithAccount` (no pagination, no 5-year cutoff), reusing the join logic from `get_transactions_paginated`. Reuse `get_accounts_for_user` as-is.
- Create a new handler module under `backend/src/handlers/` for `GET /api/export`, mirroring `get_authenticated_transactions`: `AuthContext` for `user_id`; when `connection_id` is set, resolve its accounts and filter, else export all; build the file via `ExportService`; return `impl IntoResponse` with `Content-Type` + `Content-Disposition: attachment; filename="…"`.
- Register the route in [backend/src/main.rs](../backend/src/main.rs) protected routes.
- Register the path + schemas in [backend/src/openapi/](../backend/src/openapi/) and regenerate [docs/OPENAPI.json](OPENAPI.json).

**Acceptance criteria:**
- [x] `GET /api/export?format=csv` and `?format=ofx` return the right content-type and an `attachment` `Content-Disposition`.
- [x] `?connection_id=<uuid>` restricts output to that institution's accounts/transactions.
- [x] Requests are authenticated and RLS-scoped; a user cannot export another user's data.
- [x] OpenAPI schema and `docs/OPENAPI.json` include the new endpoint.

TDD log:
- Added `backend/src/tests/export_api_tests.rs` and `backend/src/tests/openapi_tests.rs` first, then implemented the handler, route wrapper, repository export query, and OpenAPI registration.
- `cargo test -p sumurai-backend --locked export_api_tests`
- `cargo test -p sumurai-backend --locked openapi_tests`
- `cargo test -p sumurai-backend --locked export`
- `cargo check -p sumurai-backend --locked`
- `cargo clippy -p sumurai-backend -p entity -p sumurai-cli --locked --all-targets --no-deps -- -D warnings`

---

## Phase 3 — Frontend HTTP blob support & export service

**Goal:** Download binary responses through `ApiClient` and trigger a browser download.

**Tasks:**
- Add `getBlob(endpoint, options?): Promise<{ blob: Blob; filename?: string }>` to the `IHttpClient` boundary and implement in [FetchHttpClient.ts](../frontend/src/services/boundaries/FetchHttpClient.ts) (reads `response.blob()`, parses `Content-Disposition` for filename, reuses `createApiError` on failure).
- Add `ApiClient.getBlob(endpoint)` routed through the existing `makeRequest`/retry/auth-refresh path (blob branch in the GET case of `makeRawRequest`).
- Create `frontend/src/services/ExportService.ts`: `exportAccounts(format, connectionId?)` builds `/export?format=…&connection_id=…`, calls `ApiClient.getBlob`, downloads via object URL + temporary `<a download>` (filename from header, local fallback).
- Add `export type ExportFormat = 'csv' | 'ofx';` to [frontend/src/types/api.ts](../frontend/src/types/api.ts).
- Create `frontend/src/hooks/useExport.ts` wrapping `ExportService` with `isExporting`/error state surfaced via the existing toast/notification pattern.

**Acceptance criteria:**
- [x] `ApiClient.getBlob` returns the blob + filename and still benefits from auth-refresh/retry.
- [x] `ExportService.exportAccounts` builds the correct URL per format/connection and triggers a download.
- [x] `useExport` exposes loading + error state and reports success/failure to the user.

TDD log:
- Added `frontend/tests/services/boundaries/FetchHttpClient.test.ts`, `frontend/tests/services/ApiClient.test.ts`, `frontend/tests/services/ExportService.test.ts`, and `frontend/tests/hooks/useExport.test.tsx` first, then implemented `frontend/src/services/boundaries/FetchHttpClient.ts`, `frontend/src/services/ApiClient.ts`, `frontend/src/services/ExportService.ts`, and `frontend/src/hooks/useExport.ts`.
- `bun --cwd=frontend test tests/services/ApiClient.test.ts tests/services/boundaries/FetchHttpClient.test.ts tests/services/ExportService.test.ts tests/hooks/useExport.test.tsx`
- `npm --prefix frontend run typecheck`

---

## Phase 4 — Frontend UI buttons

**Goal:** Surface export controls on the Accounts tab.

**Tasks:**
- Top-level: add an "Export" `MenuDropdown` to the `PageLayout` `actions` row on [AccountsPage.tsx](../frontend/src/views/AccountsPage.tsx) (beside "Sync all"/"Connect") with items "Export as CSV" / "Export as OFX" → `exportAccounts(fmt)`.
- Per-institution: add an export `MenuDropdown`/`IconButton` to the [BankCard.tsx](../frontend/src/components/BankCard.tsx) header (beside sync/disconnect), same items → `exportAccounts(fmt, connectionId)` using the card's `connection_id`.
- Reuse existing primitives (`MenuDropdown`/`MenuItem`, `Button`/`IconButton`, `FileDown` icon).

**Acceptance criteria:**
- [ ] Top-level Export menu renders in the header and exports all institutions.
- [ ] Each `BankCard` shows an Export menu that exports only that institution.
- [ ] Loading/disabled state shows while an export is in flight.

---

## Phase 5 — Tests & validation

**Goal:** Lock behavior with tests and verify end-to-end.

**Tasks:**
- Backend ([backend/src/tests/](../backend/src/tests/)): unit-test `to_csv` (header + txn row + zero-txn account row) and `to_ofx` (header/PI, bank vs credit routing, `&`/`<` escaping, well-formed XML). **Round-trip test:** feed `to_ofx` output into `ImportService::parse_ofx` and assert parsed transactions match. Handler test for `connection_id` filtering + auth scoping.
- Frontend ([frontend/tests/](../frontend/tests/), boundary-only): `ExportService` builds the correct URL and triggers download (mock `getBlob` + URL/anchor); component test that both export menus render and dispatch with the right args.

**Acceptance criteria:**
- [ ] `cargo test -p sumurai-backend --locked export` passes, including the OFX round-trip.
- [ ] `bun --cwd=frontend test -- ExportService` and the BankCard/AccountsPage export tests pass.
- [ ] Manual at `http://localhost:8080`: top-level CSV opens correctly in a spreadsheet; OFX is valid (and re-imports); per-institution export contains only that institution; `preview_network` shows the `attachment` response with the correct filename.

---

## Key files

| Area | Path |
|------|------|
| Export format model | `backend/src/models/export.rs` (new) |
| Export serialization | `backend/src/services/export_service.rs` (new) |
| Repository query | [backend/src/services/repository_service.rs](../backend/src/services/repository_service.rs) |
| Handler + routing | `backend/src/handlers/` (new), [backend/src/main.rs](../backend/src/main.rs) |
| OpenAPI | [backend/src/openapi/](../backend/src/openapi/), [docs/OPENAPI.json](OPENAPI.json) |
| Backend deps | [backend/Cargo.toml](../backend/Cargo.toml) (`quick-xml`) |
| Import (round-trip ref) | [backend/src/services/import_service.rs](../backend/src/services/import_service.rs) |
| HTTP blob | [frontend/src/services/boundaries/FetchHttpClient.ts](../frontend/src/services/boundaries/FetchHttpClient.ts), [frontend/src/services/ApiClient.ts](../frontend/src/services/ApiClient.ts) |
| Export service / hook | `frontend/src/services/ExportService.ts` (new), `frontend/src/hooks/useExport.ts` (new) |
| Types | [frontend/src/types/api.ts](../frontend/src/types/api.ts) |
| UI | [frontend/src/views/AccountsPage.tsx](../frontend/src/views/AccountsPage.tsx), [frontend/src/components/BankCard.tsx](../frontend/src/components/BankCard.tsx) |
| Tests | `backend/src/tests/`, `frontend/tests/` |
