# Transaction File Import Feature

## Goal

Add a complete transaction file import flow so users can import CSV, QBO, and QFX exports into an existing linked account. The flow should validate the file, show a clear preview, allow CSV column mapping, import transactions through the existing transaction table, deduplicate re-imports, invalidate frontend caches, and refresh the UI.

No database migration is expected. The existing transactions schema has the required fields.

## Format Rules

QBO and QFX are OFX SGML files. They should be parsed deterministically from statement transactions:
- `TRNTYPE` maps to payment channel.
- `DTPOSTED` maps to transaction date.
- `TRNAMT` maps to amount, with stored amount normalized to the app's existing absolute-value convention.
- `FITID` maps to `provider_transaction_id` and is the deduplication key.
- `NAME` maps to merchant name after existing display-case normalization.

CSV is bank-specific. Support both split debit/credit exports and single signed amount exports. Auto-detect common headers, show the user the detected mapping, and allow adjustments before import.

Malformed files should fail gracefully. Unsupported extensions are rejected. Garbled OFX/CSV content returns a useful validation error. Row-level CSV parsing errors are collected and reported without blocking valid rows when partial import is possible.

## Phase 1: Backend Models And Parsers

### Goal

Create the backend import data models and parsing service for OFX and CSV files. This phase owns file interpretation only, not HTTP upload handling or database writes.

### Implementation Steps

1. Add backend dependencies with built-in tooling:
   - Add `ofx-rs` and `csv` in `backend/Cargo.toml`.
   - Reuse existing `sha2` for CSV synthetic deduplication keys.
   - Run the appropriate cargo update/check commands after adding dependencies so the added crates resolve to current compatible versions.

2. Create `backend/src/models/import.rs` and register it in `backend/src/models/mod.rs`.

3. Define these public model shapes:
   - `ImportFileFormat`: `Ofx` or `Csv`.
   - `CsvColumnMapping`: nullable `date_column`, `amount_column`, `debit_column`, `credit_column`, and `description_column`.
   - `PreviewTransaction`: `date`, `amount`, `description`.
   - `ValidateResponse`: validity, format, transaction count, date range, preview rows, suggested CSV mapping, sample CSV rows, errors.
   - `ImportResponse`: imported count, skipped count, truncated count, total parsed, errors.

4. Add transaction construction helpers in `backend/src/models/transaction.rs`.
   - `from_ofx` maps OFX transaction fields into the existing `Transaction` model.
   - `from_csv_row` maps a `csv::StringRecord` using `CsvColumnMapping`.
   - Imported transactions use `category_primary = "OTHER"`, `category_detailed = "OTHER"`, `pending = false`, and `provider_account_id = None`.
   - Merchant names pass through `normalize_merchant_display_case`.
   - CSV synthetic `provider_transaction_id` is deterministic from account id, date, amount, and description.

5. Create `backend/src/services/import_service.rs` and register it in `backend/src/services/mod.rs`.
   - `parse_ofx(content, account_id)` returns parsed transactions plus parse warnings/errors.
   - `detect_csv_mapping(headers)` performs case-insensitive header detection.
   - `parse_csv(content, mapping, account_id)` returns parsed transactions plus row errors.
   - `validate_file(content, filename, account_id)` detects format, validates content, returns preview data, suggested mapping, sample rows, errors, and date range.

6. Apply the five-year cutoff consistently for OFX and CSV parsing. Track how many parsed transactions were excluded as truncated.

### Acceptance Criteria

- [x] `backend/src/models/import.rs` compiles and all public request/response structs derive the serialization and OpenAPI traits used by existing models.
- [x] `Transaction::from_ofx` maps FITID, date, amount, merchant name, category defaults, pending state, and payment channel correctly.
- [x] `Transaction::from_csv_row` supports split debit/credit columns and single signed amount columns.
- [x] CSV deduplication keys are stable for identical rows and different for distinct rows.
- [x] `detect_csv_mapping` identifies the BOK Financial headers for Date, Description, Debit Amount, and Credit Amount.
- [x] OFX and CSV parsing exclude transactions older than five years and report the truncated count.
- [x] `validate_file` returns preview transactions, transaction count, date range, and clear errors for invalid content.
- [x] Backend parser tests pass with deterministic inline fixtures.

### TDD Log

- Added backend parser and model tests for OFX mapping, CSV row parsing, deduplication, header detection, cutoff handling, and validation output.
- Verified with `cargo test --manifest-path backend/Cargo.toml --locked import_service_tests -- --nocapture`.
- Verified with `cargo check --manifest-path backend/Cargo.toml --locked --all-targets`.

## Phase 2: Backend Upload And Import API

### Goal

Expose authenticated multipart endpoints that validate files, enforce account ownership, import parsed transactions, and return import results.

### Implementation Steps

1. Add authenticated routes in `backend/src/main.rs` near the existing transaction routes:
   - `POST /api/transactions/import/validate`
   - `POST /api/transactions/import`

2. Apply a 10 MB body limit to the import routes.

3. Implement multipart field handling:
   - Required fields: `file`, `account_id`.
   - Optional field for import: `csv_mapping`, JSON encoded as `CsvColumnMapping`.
   - Unknown multipart fields can be ignored.

4. Validate authentication and account ownership before parsing file content.
   - Return 401 through the existing auth middleware when unauthenticated.
   - Return 403 when the account belongs to a different user.
   - Return 400 for missing account id, missing file, unsupported extension, invalid UTF-8, invalid CSV mapping JSON, or oversized file.

5. Validation endpoint behavior:
   - Calls `validate_file`.
   - Returns `ValidateResponse`.
   - Does not write transactions.

6. Import endpoint behavior:
   - Detects format from filename.
   - Parses OFX directly or parses CSV using the submitted mapping.
   - Sets `user_id` on each transaction to the authenticated user.
   - Upserts transactions through the existing repository batch upsert path.
   - Invalidates or updates any backend cache paths required for transaction/account refresh.
   - Returns `ImportResponse`.

7. Compute skipped count by comparing account transaction counts before and after import, or by using an existing repository return value if one already exists. Do not report `0` for duplicate imports if the implementation can cheaply determine the real skipped count.

8. Add OpenAPI annotations for both endpoints consistent with the existing handler style.

### Acceptance Criteria

- [x] `POST /api/transactions/import/validate` returns 401 without auth.
- [x] `POST /api/transactions/import/validate` returns 403 for an account owned by another user.
- [x] Valid QBO/QFX validation returns a valid OFX response with five preview transactions or fewer.
- [x] Valid CSV validation returns a valid CSV response with suggested mapping and sample rows.
- [x] Unsupported extensions return a clear 400 response.
- [x] Garbled content returns a validation response with `valid = false` and useful errors.
- [x] Valid QBO/QFX import writes transactions with `user_id` set and default category values.
- [x] Re-importing the same OFX file reports skipped duplicates based on FITID deduplication.
- [x] CSV import with a custom mapping creates the expected transactions.
- [x] Files over 10 MB are rejected before parsing.
- [x] `cargo check --manifest-path backend/Cargo.toml --locked --all-targets` and relevant backend tests pass.

### TDD Log

- Added backend multipart route tests for auth, ownership, validation, unsupported extensions, garbled files, oversized payload rejection, OFX import, duplicate OFX import, and CSV import with custom mapping.
- Verified with `cargo test --manifest-path backend/Cargo.toml --locked transaction_import_api_tests -- --nocapture`.
- Verified with `cargo check --manifest-path backend/Cargo.toml --locked --all-targets`.
- Verified with `cargo test --manifest-path backend/Cargo.toml --locked`.

## Phase 3: Frontend Multipart Client And Import Service

### Goal

Add frontend API support for multipart form uploads and create a typed import service used by the UI.

### Implementation Steps

1. Add `postFormData<T>` to `frontend/src/services/boundaries/IHttpClient.ts`.

2. Implement `postFormData` in `FetchHttpClient`.
   - Do not set `Content-Type`; the browser must set the multipart boundary.
   - Include `credentials: 'include'`.
   - Reuse existing response/error handling.

3. Add `ApiClient.postFormData`.
   - Use the same retry and auth-refresh behavior as other `ApiClient` requests.
   - Ensure JSON requests still set `Content-Type` normally.

4. Add frontend import models in `frontend/src/models/import.ts`.
   - Match backend response key names exactly.
   - Use `T | null` for Rust `Option<T>` response fields rather than optional properties.

5. Add `frontend/src/services/ImportService.ts`.
   - `validate(file, accountId)` posts `file` and `account_id`.
   - `importFile(file, accountId, csvMapping?)` posts `file`, `account_id`, and optional JSON-stringified `csv_mapping`.

### Acceptance Criteria

- [x] `IHttpClient` exposes `postFormData<T>`.
- [x] `FetchHttpClient.postFormData` sends `FormData` as the body without manually setting `Content-Type`.
- [x] Multipart requests include credentials.
- [x] Multipart errors map to the existing `ApiError` subclasses.
- [x] `ApiClient.postFormData` retries transient failures consistently with existing API calls.
- [x] `ImportService.validate` sends the expected FormData fields.
- [x] `ImportService.importFile` includes `csv_mapping` only when supplied.
- [x] Frontend import types match the backend JSON shapes.
- [x] Focused service/API client tests pass.

### TDD Log

- Added `postFormData` to the HTTP client boundary, fetch adapter, and API client retry path.
- Added typed frontend import models plus an import service for validate/import multipart requests.
- Added service and boundary tests for multipart form submission, retry behavior, auth integration, and response mapping.
- Verified with `npm --prefix frontend test -- ApiClient.test.ts ImportService.test.ts FetchHttpClient.test.ts AuthService.integration.test.ts`.
- Verified with `npm --prefix frontend run typecheck`.

## Phase 4: Frontend Import State Hook

### Goal

Create a reusable hook that manages the validate, preview, import, retry, and reset workflow for the import modal.

### Implementation Steps

1. Create `frontend/src/features/import/hooks/useImportTransactions.ts`.

2. Manage these states:
   - `idle`
   - `validating`
   - `preview`
   - `validation-error`
   - `importing`
   - `success`
   - `error`

3. Track selected file, validation result, import result, CSV mapping, and user-facing error text.

4. Expose actions:
   - `validateFile(file)`
   - `importFile(file, mapping?)`
   - `setCsvMapping(mapping)`
   - `reset()`
   - `backToPreview()`

5. On successful import, invalidate stale Plaid and Teller cache queries so account counts, transaction lists, analytics, and budgets can refresh.

### Acceptance Criteria

- [ ] Valid file selection transitions from idle to validating to preview.
- [ ] Validation failure transitions to validation-error with a useful error message.
- [ ] Import starts from preview, transitions through importing, and ends in success.
- [ ] Import failure preserves the validated file and mapping so the user can retry from preview.
- [ ] Reset clears selected file, validation result, import result, mapping, and error state.
- [ ] Successful import invalidates the relevant Plaid/Teller frontend cache queries.
- [ ] Hook tests cover success, validation failure, import failure, reset, and cache invalidation.

## Phase 5: Frontend Account Integration

### Goal

Expose file import from each account row and thread success handling back to the Accounts page.

### Implementation Steps

1. Update `AccountRow`:
   - Add `isOnline`.
   - Add `onImportSuccess?: (count: number, mask: string) => void`.
   - Add local modal open state.
   - Add an icon-only import button grouped with the transaction count pill.
   - Use a lucide upload icon.
   - Use `aria-label="Import transactions"` and `title="Import transactions"`.
   - Disable and visually dim the import button while offline.
   - Render `ImportModal` for the selected account.

2. Thread props through:
   - `AccountsPage`
   - `ConnectionsList`
   - `BankCard`
   - `AccountRow`
   - `ImportModal`

3. On import success:
   - Show a toast such as `Imported X transactions for ••1234`.
   - Let the hook-driven cache invalidation refresh counts and dependent screens.

### Acceptance Criteria

- [ ] Each account row shows an accessible import icon button next to the transaction count.
- [ ] The import button is disabled while offline.
- [ ] Clicking the import button opens the modal for the correct account.
- [ ] `onImportSuccess` is threaded from Accounts page to the modal.
- [ ] Successful import closes the modal and shows the success toast with the account mask.
- [ ] Existing sync, disconnect, collapse, and account display behavior still works.

## Phase 6: Import Modal UX And PWA Layout

### Goal

Build a polished import modal that feels native to Sumurai, handles CSV complexity without overwhelming the user, and works across mobile, tablet, desktop, and installed PWA layouts. The flow should be opinionated by default: auto-detect what the app needs, show a concise review, and require the user to adjust only when detection is incomplete or wrong.

### Implementation Steps

1. Create `frontend/src/features/import/components/ImportModal.tsx`.

2. Use existing primitives and recipes only:
   - `Modal`
   - `GlassCard`
   - `Button`
   - `Alert`
   - `FormLabel`
   - `Select`
   - `Pill`
   - `cn`
   - shared `text`, `font`, `surface`, `border`, and `status` recipes

3. Use this shell:
   - `Modal` with `size="lg"`.
   - `GlassCard` with `variant="accent"`, `rounded="xl"`, `padding="lg"`, `withInnerEffects={false}`.
   - Card layout: header, scrollable body, sticky footer.
   - Modal max height: use dynamic viewport units, for example `max-h-[min(82dvh,42rem)]`.

4. Header requirements:
   - Title: "Import transactions".
   - Account name and masked account.
   - Selected file name when available.
   - Compact file format or status pill when available.
   - Close action only when the current state can be safely dismissed.

5. Footer requirements:
   - Keep primary actions reachable at all breakpoints.
   - Stack actions on mobile.
   - Align actions in a row on tablet and desktop when there is room.
   - Hide actionable footer buttons during validating and importing.
   - Use one clear primary action per state: "Choose file", "Import transactions", "Done", or "Try again".

6. State layouts:
   - Upload: one large tappable drop zone with `UploadCloud`, accepted formats, max size, selected-file metadata, and a replace-file affordance.
   - Validating: centered `Loader2`, file/account context, no dismissal through backdrop or Escape.
   - Validation error: `Alert variant="error"` with backend error text and a "Try another file" action.
   - Preview: summary row, confidence/readiness message, preview table, optional CSV mapping controls, and explicit "Import transactions" confirmation.
   - Importing: centered `Loader2`, transaction count context, no dismissal through backdrop or Escape.
   - Success: receipt with imported, skipped, truncated, and row-error counts plus warnings for partial import.
   - Import error: preserve file and mapping, show "Try again" and "Choose another file".

7. CSV mapping UX:
   - Editing column mapping is not drag-and-drop. Drag-and-drop is only for uploading a file.
   - Default to a collapsed "Review column mapping" control when detection is complete.
   - Auto-expand mapping controls only when required fields are missing or conflicting.
   - Render an opinionated readiness message above the preview, such as "Ready to import" or "Choose columns to continue".
   - The collapsed control should show a compact summary of the detected mapping, for example `Date: Date`, `Description: Description`, `Amount: Debit/Credit`.
   - When expanded, the user edits mapping by choosing file columns from labeled native select dropdowns for Date, Description, Amount, Debit, and Credit.
   - Each select option is one detected file header, plus a blank/not used option for optional fields.
   - Mapping edits apply immediately to the selected mapping used for import.
   - If the current backend response can support client-side preview recomputation from sample rows, update the preview after each mapping change; otherwise keep the existing preview visible and clearly indicate the adjusted mapping will be used when importing.
   - Provide a small "Reset detected mapping" action inside the expanded mapping area so users can undo manual changes without choosing the file again.
   - Use native `Select` controls.
   - Use one column on mobile and two columns from tablet upward.
   - Date and Description are required.
   - Either Amount or Debit/Credit is required.
   - Choosing Amount clears Debit and Credit.
   - Choosing Debit or Credit clears Amount.
   - Disable import while required mapping is incomplete.
   - Do not make users confirm every detected column when the suggested mapping is complete; let them import directly after reviewing the sample rows.

8. Preview table UX:
   - Use a real table inside an `overflow-x-auto` wrapper.
   - Columns: Date, Description, Amount.
   - Use `tabular-nums` for amounts.
   - Positive amounts use success text; negative amounts use danger text.
   - Long descriptions truncate visually and expose full text through `title`.
   - Show only the small preview returned by the backend, not the full file, to keep the modal lightweight.
   - Use the preview to answer the user's core question: "Does this look like the right file for this account?"

9. Responsive PWA layouts:
   - Breakpoints follow `frontend/tailwind.config.js`: mobile `<768px`, tablet `768-1023px`, desktop `>=1024px`.
   - Mobile: single-column header metadata, one-column mapping, horizontal table scroll, stacked footer actions, tappable controls, no hover-only affordances.
   - Tablet: centered modal, two-column mapping, readable preview table, row footer actions when space allows.
   - Desktop: centered modal capped at `lg`; do not stretch the modal beyond readable mapping/table widths.
   - Constrained installed desktop PWA windows follow the mobile/tablet/desktop layout based on actual viewport width.
   - Respect `env(safe-area-inset-*)` where needed so actions are not hidden under home indicators or display cutouts.
   - Use `dvh` sizing so standalone PWA, browser chrome, and virtual keyboard changes do not obscure the modal.

10. Interaction details:
   - Reset the hidden file input value after every file selection so the same file can be selected again.
   - Prevent default drag-over behavior so the browser does not navigate to the dropped file.
   - Return focus to the triggering control after native file picker or select interactions close where practical.

### Acceptance Criteria

- [ ] Modal uses the specified Sumurai primitives and no new design tokens.
- [ ] Upload state is clear, tappable, and supports file selection and drag/drop.
- [ ] Validating and importing states cannot be dismissed through backdrop or Escape.
- [ ] Validation errors and import errors are visually distinct and actionable.
- [ ] Preview state shows transaction count, date range, format, account mask, readiness message, and preview table.
- [ ] CSV mapping is collapsed by default when auto-detection is complete and expanded automatically when user action is required.
- [ ] CSV mapping rules are enforced in the UI without making users manually confirm correct auto-detected columns.
- [ ] Success state shows imported, skipped, truncated, and row-error counts.
- [ ] Mobile `<768px`, tablet `768-1023px`, and desktop `>=1024px` layouts all remain usable.
- [ ] Installed PWA safe-area and `dvh` constraints are handled.
- [ ] Storybook stories cover upload, validating, OFX preview, CSV preview, importing, success, validation error, import error, mobile, tablet, desktop, and constrained PWA layouts.

## Phase 7: Testing And Verification

### Goal

Prove the import flow works at service, hook, UI, API, parser, and manual workflow boundaries without over-testing private implementation details.

### Implementation Steps

1. Backend tests:
   - Place tests in `backend/src/tests/`.
   - Add inline fixtures for valid OFX, split CSV, signed-amount CSV, invalid content, old transactions, and duplicate imports.
   - Cover parser behavior, validation behavior, endpoint auth/ownership behavior, and import/dedup behavior.

2. Frontend service tests:
   - `ImportService` FormData construction.
   - `FetchHttpClient.postFormData` multipart behavior.
   - `ApiClient.postFormData` retry/error behavior.

3. Frontend hook tests:
   - Validation success.
   - Validation failure.
   - Import success.
   - Import failure with preserved preview context.
   - Reset behavior.
   - Cache invalidation.

4. Storybook Vitest coverage:
   - Import modal states.
   - CSV mapping behavior.
   - Account row import trigger.
   - Disabled offline trigger.
   - Mobile/tablet/desktop/PWA layout scenarios.

5. Manual verification:
   - Start the dev stack.
   - Import the provided QBO file into an account and verify preview, receipt, toast, and transaction visibility.
   - Re-import the same QBO file and verify skipped duplicates.
   - Import the provided CSV file, adjust mapping, and verify receipt.
   - Verify Transactions, Analytics, and Budgets reflect the imported data.
   - Verify malformed file handling.
   - Verify mobile, tablet, desktop, and installed-PWA-style constrained layouts.

### Acceptance Criteria

- [ ] Backend parser and API tests pass.
- [ ] Frontend service and hook tests pass.
- [ ] Storybook Vitest scenarios pass for the import UI.
- [ ] Manual QBO import works end to end.
- [ ] Manual QBO re-import reports duplicates as skipped.
- [ ] Manual CSV import works with detected and adjusted mapping.
- [ ] Malformed file handling is clear and recoverable.
- [ ] Imported transactions appear in Transactions and update dependent Analytics/Budgets views after cache invalidation.
- [ ] Layout verification passes for mobile `<768px`, tablet `768-1023px`, desktop `>=1024px`, and constrained installed PWA windows.
- [ ] Recommended final commands pass:
  - `cargo test --manifest-path backend/Cargo.toml --locked`
  - `cargo check --manifest-path backend/Cargo.toml --locked --all-targets`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run test:storybook`
  - `npm --prefix frontend run typecheck`

## Security And Data Handling

- Never persist uploaded file bytes.
- Never write raw file contents to logs.
- Validate account ownership before file parsing.
- Keep import routes authenticated.
- Enforce the 10 MB upload limit.
- Reject unsupported extensions and invalid file structures.
- Sanitize merchant names through existing normalization and truncation behavior.
- Preserve existing RLS and repository write paths.
- Use FITID for OFX deduplication and deterministic synthetic keys for CSV deduplication.

## Files Touched

Expected backend files:
- `backend/Cargo.toml`
- `backend/Cargo.lock`
- `backend/src/models/import.rs`
- `backend/src/models/mod.rs`
- `backend/src/models/transaction.rs`
- `backend/src/services/import_service.rs`
- `backend/src/services/mod.rs`
- `backend/src/main.rs`
- `backend/src/tests/`

Expected frontend files:
- `frontend/src/models/import.ts`
- `frontend/src/services/boundaries/IHttpClient.ts`
- `frontend/src/services/boundaries/FetchHttpClient.ts`
- `frontend/src/services/ApiClient.ts`
- `frontend/src/services/ImportService.ts`
- `frontend/src/features/import/hooks/useImportTransactions.ts`
- `frontend/src/features/import/components/ImportModal.tsx`
- `frontend/src/features/import/components/ImportModal.stories.tsx`
- `frontend/src/components/AccountRow.tsx`
- `frontend/src/components/BankCard.tsx`
- `frontend/src/features/plaid/components/ConnectionsList.tsx`
- `frontend/src/views/AccountsPage.tsx`
- `frontend/tests/`

## Notes For The Implementer

- Keep models in model folders, business logic in service folders, and tests in test folders.
- Follow existing repository patterns before adding new abstractions.
- Keep the UI prescriptive where specified; the import modal is the main user-facing quality bar for this feature.
- Do not change unrelated UI surfaces.
- Do not read or write `.env` files.
