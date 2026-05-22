# User-Editable Transaction Categories — System + Custom, with Override Propagation

> **Handoff note for the implementing agent.** Work the phases below in order. Each phase has a **Goal**, **Tasks**, and **Acceptance Criteria** you must satisfy before moving on. Follow strict TDD per the `phase-implementer` skill (red → green → refactor) and boundary-only testing per `sumurai-testing-policy`. Tests live in `backend/src/tests/` and `frontend/tests/` only — never inline. Do **not** modify the ML categorization flow ([backend/src/services/categorization/](backend/src/services/categorization/)) and do **not** modify provider-sync category write paths. The override layer applies at read time on top of whatever ML or providers wrote.

---

## Context

The just-shipped ML categorization service ([backend/src/services/categorization/](backend/src/services/categorization/)) auto-assigns a Plaid-PFC primary category to manually imported transactions; provider syncs already set their own categories. What is missing is **user agency**: there is no way for a user to correct or personalize a category, and no way to express a category that is meaningful to them but absent from the system list.

This feature lets the user:

1. **Click a category Pill in the transactions table** to re-categorize that transaction inline. The picker shows every existing category (system + custom) and lets the user type a brand-new custom name.
2. **Have that choice propagate** to every transaction with a similar description (numbers/symbols stripped). One correction on "STARBUCKS #123" applies to "STARBUCKS 4421" and any future imports.
3. **Delete a custom category** via an X on its filter chip. Transactions silently fall back to their stored system category (no data loss).

Design rules (confirmed with the user):

- The original `transactions.category_primary` is never overwritten — provider/ML categories remain the fallback.
- Any override (to a system OR custom category) participates in normalized-description matching.
- Override applies retroactively at read time, so existing rows reflect the user's choice immediately.
- Custom categories are first-class: their own table, joinable, deletable, scoped per-user (RLS).
- Picker UX is hashtag-style: filter existing options as user types; offer "Create '<typed>'" when no match.
- Validation: **alphabetic + whitespace only** (no digits, no symbols, no punctuation), max 3 words, max 30 chars, auto-capitalize each word, reject case-insensitive collisions with system categories *and* with the user's other custom categories — including trivial plural variants (trailing `s` stripped before comparison).

---

## Phase 1 — Foundations: schema, models, normalization helpers

**Goal.** Land the persistent shape (two new tables + a generated column on `transactions`), the typed models, and the text-normalization helpers. No behavior change yet.

**Tasks.**

1. **Migrations** under `backend/migrations/`, following the numeric + snake_case convention of [008_budgets_table.sql](backend/migrations/008_budgets_table.sql) (template for RLS policy + `updated_at` trigger):

   - `023_user_custom_categories.sql`:
     ```sql
     CREATE TABLE user_custom_categories (
         id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         display_name VARCHAR(30) NOT NULL,
         lookup_key   VARCHAR(30) NOT NULL,
         created_at   TIMESTAMPTZ DEFAULT NOW(),
         updated_at   TIMESTAMPTZ DEFAULT NOW(),
         UNIQUE (user_id, lookup_key)
     );
     CREATE INDEX idx_user_custom_categories_user
         ON user_custom_categories(user_id, display_name);
     -- ENABLE ROW LEVEL SECURITY + CREATE POLICY (mirror migrations/005)
     -- CREATE TRIGGER update_user_custom_categories_updated_at (mirror migrations/008)
     ```
   - `024_transaction_category_overrides.sql`:
     ```sql
     CREATE TABLE transaction_category_overrides (
         id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         normalized_merchant TEXT NOT NULL,
         category_name       VARCHAR(64) NOT NULL,
         custom_category_id  UUID REFERENCES user_custom_categories(id) ON DELETE CASCADE,
         created_at          TIMESTAMPTZ DEFAULT NOW(),
         updated_at          TIMESTAMPTZ DEFAULT NOW(),
         UNIQUE (user_id, normalized_merchant)
     );
     CREATE INDEX idx_overrides_user_norm
         ON transaction_category_overrides(user_id, normalized_merchant);
     -- RLS policy + updated_at trigger
     ```
     `ON DELETE CASCADE` on `custom_category_id` gives the fallback behavior the user asked for: deleting a custom category drops overrides pointing at it, so the read-side overlay falls through to `transactions.category_primary`.
   - `025_transactions_normalized_merchant.sql`:
     ```sql
     ALTER TABLE transactions
       ADD COLUMN normalized_merchant TEXT
       GENERATED ALWAYS AS (regexp_replace(lower(coalesce(merchant_name, '')), '[^a-z]', '', 'g')) STORED;
     CREATE INDEX idx_transactions_user_norm_merchant
       ON transactions(user_id, normalized_merchant);
     ```

2. **Normalization helpers** — extend [backend/src/utils/merchant_name.rs](backend/src/utils/merchant_name.rs) (single home for text normalization, alongside the existing `normalize_merchant_display_case`):

   ```rust
   pub fn normalize_merchant_for_match(raw: &str) -> String { /* lowercase, keep [a-z] only, collapse ws, trim */ }
   pub fn category_lookup_key(raw: &str) -> String { /* lowercase, trim, collapse ws, strip trailing 's' on each word */ }
   pub fn format_custom_category_display(raw: &str) -> String { /* title-case each whitespace-split token */ }
   ```

   `normalize_merchant_for_match` must produce byte-identical output to the SQL `regexp_replace` in migration `025`.

3. **Models** — new files re-exported from [backend/src/models/mod.rs](backend/src/models/mod.rs):
   - `backend/src/models/custom_category.rs`: `CustomCategory` (`FromRow` + `Serialize`), `CreateCustomCategoryRequest { name: String }`, `CustomCategoryError` enum (`NameTooLong`, `TooManyWords`, `EmptyName`, `InvalidCharacters`, `CollidesWithSystemCategory`, `CollidesWithExistingCustom`).
   - `backend/src/models/transaction_category_override.rs`: `TransactionCategoryOverride` (`FromRow` + `Serialize`), `SetTransactionCategoryRequest { category_name: String, is_custom: bool }`.

**Acceptance criteria.**
- [x] `cargo sqlx migrate run` (or the project's equivalent) succeeds on a fresh DB.
- [x] `normalize_merchant_for_match` produces byte-identical output to the SQL `regexp_replace` in migration `025` for representative fixtures (punctuation, multi-byte, numbers, leading/trailing whitespace, empty, NULL).
- [x] `cargo check --manifest-path backend/Cargo.toml --locked --all-targets` passes (models referenced from nowhere yet is OK — Phase 2 will use them).
- [x] No changes outside `backend/migrations/`, `backend/src/models/`, and `backend/src/utils/merchant_name.rs`.

---

## Phase 2 — Category management service + repository

**Goal.** Add typed CRUD for custom categories and overrides behind a service interface, with all SQL going through `DatabaseRepository`. Still no HTTP surface; this phase is callable only from tests.

**Tasks.**

1. **Repository methods** on the `DatabaseRepository` trait in [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs), following the existing `begin tx → set_config('app.current_user_id', ...) → query → commit` pattern (see `upsert_transactions_batch` at [repository_service.rs:577](backend/src/services/repository_service.rs)):
   - `create_custom_category(user_id, display_name, lookup_key) -> Result<CustomCategory>`
   - `list_custom_categories_for_user(user_id) -> Result<Vec<CustomCategory>>`
   - `delete_custom_category(user_id, id) -> Result<()>`
   - `upsert_transaction_category_override(user_id, normalized_merchant, category_name, custom_category_id: Option<Uuid>) -> Result<TransactionCategoryOverride>`
   - `delete_transaction_category_override_by_norm(user_id, normalized_merchant) -> Result<()>`
   - `get_transaction_by_id_for_user(user_id, id) -> Result<Option<Transaction>>` (Phase 3 handler needs this to resolve `normalized_merchant`)

   Add corresponding `MockDatabaseRepository` expectations.

2. **Category management service** — new module `backend/src/services/category_management/` re-exported from [backend/src/services/mod.rs](backend/src/services/mod.rs):
   - `mod.rs`
   - `service.rs` — `CategoryManagementService` (held by `AppState` as `Arc<CategoryManagementService>`). Constructor takes the repo handle + the static system slug set sourced from [backend/src/services/categorization/category_descriptors.rs](backend/src/services/categorization/category_descriptors.rs) (single source of truth for system categories).
   - Methods:
     - `list_categories_for_user(user_id) -> Result<CategoryListResponse { system: Vec<String>, custom: Vec<CustomCategory> }>`
     - `create_custom_category(user_id, raw_name) -> Result<CustomCategory, CustomCategoryError>` — trims, rejects any character outside `[A-Za-z]` plus inter-word whitespace (`InvalidCharacters`), enforces ≤3 words & ≤30 chars, applies `format_custom_category_display`, derives `lookup_key` via `category_lookup_key`, rejects collisions with system slugs and existing user customs (compared on `lookup_key`).
     - `delete_custom_category(user_id, id) -> Result<()>` — cascade in migration `024` handles override cleanup.
     - `set_transaction_category(user_id, transaction_id, request) -> Result<Option<TransactionCategoryOverride>>` — loads the transaction (RLS-scoped), reads its `normalized_merchant`, then:
       - If `request.category_name` equals the transaction's stored `category_primary` AND `!is_custom`: delete any existing override (user "reverted"); return `Ok(None)`.
       - Else upsert an override keyed by `(user_id, normalized_merchant)`. If `is_custom`, look up `custom_category_id` from the user's customs (do **not** auto-create — the frontend is responsible for calling create-custom first; surface `NotFound` if missing).

3. **Wire** `CategoryManagementService` into `AppState` in [backend/src/main.rs](backend/src/main.rs) alongside `repository_service`, `cache_service`, `categorizer`. Construction must be infallible (no I/O); fail-fast policy from `performance-cost-architecture` does not apply here.

**Acceptance criteria.**
- [x] Service rejects: 4-word names, 31-char names, empty/whitespace-only names, any input containing digits or symbols (e.g. `"Coffee 1"`, `"Co-ffee"`, `"FOOD_AND_DRINK"`), plural collisions (`"Foods"` vs existing `"Food"`), and case-insensitive system-slug collisions (`"Food and Drink"` collides with `FOOD_AND_DRINK`).
- [x] Service accepts `"  coffee   runs  "` and persists display `"Coffee Runs"`, `lookup_key` `"coffee run"`.
- [x] `set_transaction_category` deletes the override when the user re-picks the row's current `category_primary` with `is_custom=false`.
- [x] `set_transaction_category` returns `NotFound` when `is_custom=true` references a custom the user does not own.
- [x] `cargo check --manifest-path backend/Cargo.toml --locked --all-targets` and `cargo clippy ... -D warnings` pass.
- [x] No edits to `backend/src/services/categorization/`, provider modules, sync service, or any handler. Confirm by grep.

**TDD log (Phase 2):** 13 tests in `category_management_service_tests.rs`. All validation paths, system-slug collision, plural-collision, whitespace normalization, revert-to-primary delete, custom-not-found, foreign-transaction-not-found, and happy-path upsert covered. 316 backend + 566 frontend tests pass. Commit: e7f0904.

---

## Phase 3 — Handlers, routes, OpenAPI

**Goal.** Expose four endpoints. Keep the contract typed and OpenAPI-registered so the frontend types can mirror cleanly.

**Tasks.**

1. **Handlers** in [backend/src/main.rs](backend/src/main.rs) (follow the existing handler shape, e.g. `import_authenticated_transactions` at [main.rs:1330](backend/src/main.rs); use the `auth_context: AuthContext` extractor):
   | Method | Path | Handler | Body / Response |
   |---|---|---|---|
   | GET    | `/api/categories`                | `list_categories`         | → `CategoryListResponse` |
   | POST   | `/api/categories/custom`         | `create_custom_category`  | `{ name }` → `CustomCategory` or `400` with `{ code }` |
   | DELETE | `/api/categories/custom/{id}`    | `delete_custom_category`  | `204` |
   | PUT    | `/api/transactions/{id}/category`| `set_transaction_category`| `{ category_name, is_custom }` → `200` |

   Validation errors map to `400` with a stable `code` string the frontend can switch on.

2. **Register** routes next to the existing transaction routes at [main.rs:338](backend/src/main.rs).

3. **OpenAPI** — register schemas and handler paths in [backend/src/openapi/mod.rs](backend/src/openapi/mod.rs) following the `paths(...) / components(schemas(...))` macro pattern already in use. Regenerate `docs/OPENAPI.json` per [CLAUDE.md](CLAUDE.md).

**Acceptance criteria.**
- [x] `GET /api/categories` returns merged system + custom for the authenticated user.
- [x] `POST /api/categories/custom` happy path returns 200 with the persisted row; validation errors return 400 with a stable `code`.
- [x] `DELETE /api/categories/custom/{id}` returns 204; foreign id returns 404 (no RLS leak); unauthenticated requests return 401.
- [x] `PUT /api/transactions/{id}/category` upserts override for a different category, deletes override when re-picking the stored `category_primary` with `is_custom=false`, returns 400 with `custom_category_not_found` for an unknown custom, returns 404 for a foreign transaction id.
- [x] `cargo fmt --check`, `cargo check --all-targets`, `cargo clippy ... -D warnings` all pass.
- [x] OpenAPI schemas and paths registered; JSON regeneratable via `init_openapi()`.
- [x] No changes to provider modules, sync service, ML categorization, or the import handler.

**TDD log (Phase 3):** 11 boundary tests in `category_handlers_integration_tests.rs`. All happy paths + error codes + auth coverage. Tests mock only at DatabaseRepository level. 327 backend tests pass (includes 316 pre-existing + 11 new). 566 frontend tests pass. Commit: 0bd2975.

---

## Phase 4 — Read-path overlay (LEFT JOIN against overrides)

**Goal.** Make stored overrides materialize on every transaction read so the UI sees overridden categories without any frontend rewrite of the row data. Filtering by a category must match its **effective** value.

**Tasks.**

1. Modify `get_transactions_paginated`, `get_transactions_for_user`, and `get_authenticated_transactions_insights` in [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs) to:
   - `LEFT JOIN transaction_category_overrides o ON o.user_id = t.user_id AND o.normalized_merchant = t.normalized_merchant`
   - Project `COALESCE(o.category_name, t.category_primary) AS effective_category` and `(o.id IS NOT NULL) AS is_overridden` and `(o.custom_category_id IS NOT NULL) AS is_custom`.
   - The optional `category_primary` filter must filter on `effective_category`, not the raw column. Otherwise filtering by a custom category returns nothing.
   - Insights aggregation buckets by `effective_category`.

2. Extend the serialized transaction-category shape returned to the frontend. In the handler response model (whichever struct currently mirrors `TransactionCategory`), add:
   ```rust
   pub struct TransactionCategoryResponse {
       pub primary: String,        // effective_category
       pub detailed: String,       // unchanged
       pub confidence_level: String,
       pub is_custom: bool,
       pub is_overridden: bool,
   }
   ```
   Existing fields stay backwards-compatible.

3. **Do not** modify `upsert_transactions_batch` or any provider-sync write path. The `ON CONFLICT DO UPDATE` at [repository_service.rs:621](backend/src/services/repository_service.rs) already excludes category columns from updates, so historical overrides survive future syncs without code change.

**Acceptance criteria.**
- [x] List returns `effective_category` from override when one exists; `category_primary` otherwise.
- [x] Filtering by an overridden custom category returns exactly the matching rows.
- [x] Filtering by a system category returns rows whose `category_primary` is that slug AND rows overridden TO that slug.
- [x] Deleting the underlying custom cascades the override away; subsequent list returns the original `category_primary`.
- [x] Two rows with the same `normalized_merchant` (`"STARBUCKS #123"` and `"STARBUCKS 4421"`) both pick up the same override.
- [x] Insights aggregation buckets respect the override.
- [x] **Pre-existing transaction-related tests still pass** (this phase changes shared read paths): `cargo test --manifest-path backend/Cargo.toml --locked --all-targets`.
- [x] `cargo fmt --check`, `cargo check --all-targets`, `cargo clippy ... -D warnings` all pass.
- [x] No provider-sync or import handler changes.

**TDD log (Phase 4):** 4 tests in `read_path_overlay_tests.rs` covering: effective category returns when override exists, stored category fallback when no override, filtering by overridden category, and insights aggregation by effective category. All 331 backend tests pass (327 pre-existing + 4 new). Commit: ada49c7.

---

## Phase 5 — Frontend types, services, hooks

**Goal.** Wire the new backend surface into the frontend's tanstack-query layer. No UI changes yet; consumers still call the existing components but with new data sources.

**Tasks.**

1. **Types** — extend [frontend/src/types/api.ts](frontend/src/types/api.ts):
   ```ts
   export interface CustomCategory { id: string; display_name: string; lookup_key: string; }
   export interface CategoryListResponse { system: string[]; custom: CustomCategory[]; }
   export interface TransactionCategory {
     primary: string;
     detailed?: string;
     confidence_level?: string;
     is_custom?: boolean;
     is_overridden?: boolean;
   }
   ```

2. **Services** — route everything through `ApiClient` ([CLAUDE.md](CLAUDE.md): never bypass it):
   - New `frontend/src/services/CategoryService.ts`: `listCategories()`, `createCustomCategory(name)`, `deleteCustomCategory(id)`.
   - Extend [frontend/src/services/TransactionService.ts](frontend/src/services/TransactionService.ts): `updateTransactionCategory(id, { category_name, is_custom })`.

3. **Hooks** — `frontend/src/features/transactions/hooks/`, mirroring the existing query-key + invalidation patterns in [useTransactions.ts](frontend/src/features/transactions/hooks/useTransactions.ts) and [useTransactionCategories.ts](frontend/src/features/transactions/hooks/useTransactionCategories.ts):
   - `useCategories()` — query key `['categories']`, returns `{ system, custom, all }`. The current `useTransactionCategories` becomes a thin shim over this or is deleted (callers updated).
   - `useCreateCustomCategory()` — invalidates `['categories']`.
   - `useDeleteCustomCategory()` — invalidates `['categories']` AND `['transactions', 'list']`.
   - `useUpdateTransactionCategory()` — optimistic update of `['transactions', 'list']`, then invalidates `['transactions', 'list']` + `['categories']` on success.

4. **Client-side validation helper** in [frontend/src/utils/categories.ts](frontend/src/utils/categories.ts):
   - `categoryLookupKey(raw: string): string`
   - `formatCustomCategoryDisplay(raw: string): string`
   - `validateCustomCategoryName(raw: string, existing: { system: string[]; custom: CustomCategory[] }): { ok: true; display: string } | { ok: false; code: 'too_long' | 'too_many_words' | 'empty' | 'invalid_characters' | 'collides_system' | 'collides_custom' }`

   Must match the backend rules byte-for-byte (mirror `category_lookup_key` and `format_custom_category_display`) so the UI never claims a name is valid that the server then rejects.

**Acceptance criteria.**
- [ ] `useUpdateTransactionCategory` applies an optimistic update and rolls back on mutation error.
- [ ] `useDeleteCustomCategory` invalidates both `['categories']` and `['transactions', 'list']`.
- [ ] `validateCustomCategoryName` produces the correct typed error for each rule (too-long, too-many-words, empty, invalid-characters, collides-system, collides-custom) and accepts the happy path.
- [ ] `npm --prefix frontend run lint` and `npm --prefix frontend run typecheck` pass.
- [ ] No UI components changed yet — `TransactionsTable.tsx`, `TransactionsFilters.tsx`, `TransactionsPage.tsx` untouched. Confirm by grep.

---

## Phase 6 — `CategoryPicker` component (desktop / tablet anchored popover)

**Goal.** Build the picker as a standalone, prop-driven component. No table wiring yet — this phase is consumable from a Storybook story or a test harness. Mobile presentation is deferred to Phase 9.

**Tasks.**

1. Add `@radix-ui/react-popover` to `frontend/package.json` if not already present, then upgrade per `~/.claude/CLAUDE.md`. No existing combobox primitive in [frontend/src/ui/primitives/](frontend/src/ui/primitives/), so Popover is the base.
2. Create `frontend/src/features/transactions/components/CategoryPicker.tsx`. Props:
   ```ts
   interface Props {
     open: boolean;
     anchorRef: React.RefObject<HTMLElement>;
     currentCategory: { name: string; isCustom: boolean };
     onSelect: (selection: { categoryName: string; isCustom: boolean }) => void;
     onRequestClose: () => void;
   }
   ```
   The component reads `useCategories` internally and uses `useCreateCustomCategory` for the create-then-select flow; it does **not** call `useUpdateTransactionCategory` itself — the parent owns the mutation so this component stays reusable.
3. Layout (top to bottom inside the Popover):
   - **Suggested section** — merged system + custom categories rendered as selectable chips (reuse `Pill` + `getTagThemeForCategory`). The current category is visually marked as selected. The list scrolls vertically when it overflows.
   - Divider.
   - **Type your own** — `Input` with live `validateCustomCategoryName` errors beneath. Auto-capitalizes each word as the user types (via `formatCustomCategoryDisplay`).
   - **Checkmark accept button** (Lucide `Check`) immediately right of the input. Disabled unless the typed value validates AND differs from `currentCategory.name`.
4. Interactions:
   - Clicking a suggested chip → `onSelect({ categoryName, isCustom })` then `onRequestClose()` immediately (no extra accept step).
   - Pressing the checkmark or Enter on a valid typed value: if new, call `useCreateCustomCategory` first; on success, `onSelect({ categoryName, isCustom: true })` then `onRequestClose()`.
   - Escape closes via `onRequestClose`.
5. **Out of scope for this phase:** the mobile bottom-sheet variant (Phase 9) and the inline-table chevron (Phase 7).

**Acceptance criteria.**
- [ ] `CategoryPicker` renders as an anchored Popover when `open` is true.
- [ ] Suggested chips include all system + custom categories from `useCategories`; current category is visibly selected.
- [ ] Clicking a suggested chip invokes `onSelect` with the correct `{ categoryName, isCustom }` and triggers `onRequestClose`.
- [ ] Typing surfaces inline validation errors covering every code from `validateCustomCategoryName`; the checkmark disables until valid.
- [ ] Accepting a new typed name creates the custom category first, then calls `onSelect`.
- [ ] `npm --prefix frontend run lint` and `npm --prefix frontend run typecheck` pass.
- [ ] No edits to `TransactionsTable.tsx`, `TransactionsFilters.tsx`, or `TransactionsPage.tsx` yet.

---

## Phase 7 — `InlineCategoryCell` + table wiring

**Goal.** Add the chevron-down affordance next to each row's category Pill and wire `CategoryPicker` into [TransactionsTable.tsx](frontend/src/features/transactions/components/TransactionsTable.tsx). Desktop / tablet only in this phase; mobile presentation lands in Phase 9.

**Tasks.**

1. Create `frontend/src/features/transactions/components/InlineCategoryCell.tsx`. Renders the existing `Pill` followed by a small chevron-down icon button (Lucide `ChevronDown`, sized to match the Pill's vertical rhythm; reuses `getTagThemeForCategory` for tinting so the chevron reads as part of the Pill cluster). The Pill itself is **not** clickable for editing — only the chevron opens the picker.
2. Local state (`open: boolean`) and a `ref` for the anchor. On chevron click, toggle `open`; render `CategoryPicker` with the anchor ref. The cell owns the `useUpdateTransactionCategory` mutation and passes its `onSelect` callback to the picker; on a successful mutation, the optimistic update from Phase 5 reflects the new category immediately.
3. Modify the category-cell JSX at [TransactionsTable.tsx:241](frontend/src/features/transactions/components/TransactionsTable.tsx) to render `<InlineCategoryCell transaction={...} />` instead of the bare `Pill`.
4. Pills with `category.is_custom` get a subtle distinguishing treatment (TBD by `sumurai-frontend-design-system`; safe default = identical to system pills until the design token pipeline says otherwise).
5. **Out of scope:** mobile presentation of the picker (Phase 9), filter-chip delete (Phase 8).

**Acceptance criteria.**
- [ ] Each table row renders a Pill followed by a chevron-down button; clicking the chevron (not the Pill body) opens `CategoryPicker` anchored to that chevron.
- [ ] Selecting from the picker invokes `useUpdateTransactionCategory` with `{ category_name, is_custom }` and the row reflects the change optimistically.
- [ ] Tabbing focus into the row reaches the chevron with a visible focus ring; Enter / Space activates it.
- [ ] `npm --prefix frontend test` (full Jest suite) passes; `lint` and `typecheck` pass.
- [ ] No changes to `TransactionsFilters.tsx` or `TransactionsPage.tsx`.

---

## Phase 8 — Custom-chip delete (`X` + confirm modal)

**Goal.** Let users delete a custom category from the filter chips with a confirmation dialog. After delete, tanstack-query invalidation drives every overridden row back to its stored `category_primary`.

**Tasks.**

1. Create `frontend/src/features/transactions/components/DeleteCustomCategoryConfirm.tsx`: a `Modal` with copy "Delete '<name>'? Transactions in this category will fall back to their original assigned category." Wired to `useDeleteCustomCategory`. Loading and error states render inline; close on success.
2. Modify the chip-rendering loop at [TransactionsFilters.tsx:138](frontend/src/features/transactions/components/TransactionsFilters.tsx):
   - Source the chip list from `useCategories` (system + custom).
   - For chips backed by a `CustomCategory`, render a Lucide `X` icon inside the chip body. Clicking the X must `stopPropagation` so the filter-toggle on the chip body does not fire.
   - The X opens `DeleteCustomCategoryConfirm` for that custom category.
   - System chips render without an X.
3. Update [TransactionsPage.tsx](frontend/src/views/TransactionsPage.tsx) to source categories from `useCategories` (replacing `useTransactionCategories`). The merged list flows into `TransactionsToolbar` → `TransactionsFilters` as before.

**Acceptance criteria.**
- [ ] Custom filter chips render the X; system chips do not.
- [ ] Clicking the X opens `DeleteCustomCategoryConfirm` and does NOT toggle the chip's filter state.
- [ ] Confirming the delete invokes `useDeleteCustomCategory`; on success the chip disappears and any rows previously overridden by that custom revert to their `category_primary` (no manual refresh — driven by the Phase 5 invalidation).
- [ ] `npm --prefix frontend test` (full Jest suite) passes; `lint` and `typecheck` pass.

---

## Phase 9 — Responsive behavior across the three project breakpoints

**Goal.** Make the picker and delete-confirm usable across desktop, tablet, and mobile. The Phase 6 / 7 / 8 components stay structurally the same; only their presentation surface changes at small widths.

**Tasks.** Breakpoints from [frontend/tailwind.config.js](frontend/tailwind.config.js): mobile = default `<768px`, tablet = `md:` `768–1023px`, desktop = `lg:` `≥1024px`.

1. **Desktop (`lg:`).** No additional work expected — the Phase 6 / 7 anchored Popover is the desktop experience. Verify visually at ≥1024px.
2. **Tablet (`md:`).** Same anchored Popover, but constrain width to the cell with enough room for at least 3 visible suggestion chips per row before vertical scroll. Chevron remains inline with the Pill.
3. **Mobile (default, `<md`).** Swap the Popover surface for the existing `Modal` primitive ([frontend/src/ui/primitives/Modal.tsx](frontend/src/ui/primitives/Modal.tsx)) styled as a bottom-anchored sheet. Requirements:
   - Full-width sheet, ≥44px tap targets on chevron, suggestion chips, input, and checkmark.
   - Body scroll-locked while open.
   - On-screen keyboard does not occlude the checkmark (anchor the input + checkmark above the keyboard).
   - Escape and back-gesture close cleanly.
4. Apply the same responsive split to `DeleteCustomCategoryConfirm` — anchored Modal on tablet / desktop; bottom-sheet Modal on mobile.
5. Audit the existing mobile representation of the transactions table. If [TransactionsTable.tsx](frontend/src/features/transactions/components/TransactionsTable.tsx) already collapses columns below `md`, ensure the chevron rides with the category cell rather than getting hidden. If the category cell is dropped entirely on mobile, expose the chevron in whatever stacked-row representation already exists; do **not** silently strip the editing affordance from mobile users.

**Acceptance criteria.**
- [ ] Verified at all three breakpoints: desktop (≥1024px) and tablet (768–1023px) render the picker as an anchored Popover; mobile (<768px) renders it as a Modal / bottom-sheet with ≥44px tap targets and the inline edit flow completes end-to-end with the on-screen keyboard open.
- [ ] `DeleteCustomCategoryConfirm` renders inside the visible viewport at all three widths.
- [ ] The chevron is visible and tappable on mobile (no silent feature drop).
- [ ] `npm --prefix frontend test` (full Jest suite) passes; `lint` and `typecheck` pass.
- [ ] Existing snapshots / Storybook stories for `TransactionsTable` and `TransactionsFilters` updated if `sumurai-frontend-design-system` requires.

---

## Phase 10 — End-to-end verification

**Goal.** Prove the pipeline works in the running stack and behaves resiliently.

**Tasks.**

1. Start the full stack via the project's dev script (per [AGENTS.md](AGENTS.md) / [CONTRIBUTING.md](CONTRIBUTING.md)). Visit `http://localhost:8080` (per [CLAUDE.md](CLAUDE.md) — **not** `:3001`).
2. Prepare a CSV with at least: `STARBUCKS #123`, `STARBUCKS 4421`, `SHELL OIL 5512`, `NETFLIX.COM`.
3. Import via the UI. Click the Pill on `STARBUCKS #123` → picker opens → type `Coffee` → "Create 'Coffee'" → row updates to **Coffee**. Confirm `STARBUCKS 4421` also flips to **Coffee** without manual action.
4. Re-import the same CSV (or any file containing `STARBUCKS 9999`) → the new row lands as **Coffee**.
5. Filter chips area shows a **Coffee** chip with an X. Click the X → confirm dialog → confirm → both rows revert to their underlying stored category; chip disappears.
6. Click a Pill, pick the row's current system category (e.g. `FOOD_AND_DRINK` on a row already `FOOD_AND_DRINK`) → verify in psql that no override row exists for that user/normalized_merchant.
7. Validation: try `Coffees` after `Coffee` exists → "collides with Coffee". Try `Food and Drink` → "collides with system category". Try `Coffee 1` or `Co-ffee` → "letters only". Try 4 words / 31 chars → respective errors. All errors must surface inline before any network call.
8. Trigger a Plaid or Teller provider sync (depending on local creds). Confirm provider categories still write to `category_primary` and the override layer continues to apply on read; provider-only rows without an override are unaffected.
9. Delete the custom category while a list page is showing rows overridden by it → tanstack invalidation refreshes the table and the rows revert; no stale chip remains in filters.
10. **Responsive pass at all three breakpoints.** Resize the browser to ≥1024px (desktop), 800px (tablet), and 360px (mobile). At each width, repeat step 3 (chevron visible, picker opens, accept commits the change) and step 5 (filter-chip X tappable, confirm modal renders within viewport). On mobile, additionally verify the on-screen keyboard does not occlude the checkmark in the picker.

**Acceptance criteria.**
- [ ] Steps 3–6 succeed as described.
- [ ] Step 7 inline errors all render before the network call.
- [ ] Step 8 confirms provider sync is unaffected (Plaid/Teller categories unchanged where no override applies).
- [ ] Step 9 verifies tanstack invalidation closes the loop.
- [ ] `cargo test --manifest-path backend/Cargo.toml --locked` (full suite) passes.
- [ ] `npm --prefix frontend test` (full suite) passes.
- [ ] `cargo fmt --check`, `cargo check --all-targets`, `cargo clippy ... -D warnings` pass.

---

## Critical files (summary, for orientation)

**New (backend):**
- `backend/migrations/023_user_custom_categories.sql`
- `backend/migrations/024_transaction_category_overrides.sql`
- `backend/migrations/025_transactions_normalized_merchant.sql`
- `backend/src/models/custom_category.rs`
- `backend/src/models/transaction_category_override.rs`
- `backend/src/services/category_management/mod.rs`
- `backend/src/services/category_management/service.rs`

**Modified (backend):**
- [backend/src/models/mod.rs](backend/src/models/mod.rs), [backend/src/services/mod.rs](backend/src/services/mod.rs)
- [backend/src/utils/merchant_name.rs](backend/src/utils/merchant_name.rs)
- [backend/src/services/repository_service.rs](backend/src/services/repository_service.rs) (new methods + LEFT JOIN on read paths)
- [backend/src/main.rs](backend/src/main.rs) (`AppState` + 4 handlers + route registration)
- [backend/src/openapi/mod.rs](backend/src/openapi/mod.rs) and `docs/OPENAPI.json`

**New (frontend):**
- `frontend/src/services/CategoryService.ts`
- `frontend/src/features/transactions/hooks/useCategories.ts`
- `frontend/src/features/transactions/hooks/useCreateCustomCategory.ts`
- `frontend/src/features/transactions/hooks/useDeleteCustomCategory.ts`
- `frontend/src/features/transactions/hooks/useUpdateTransactionCategory.ts`
- `frontend/src/features/transactions/components/CategoryPicker.tsx`
- `frontend/src/features/transactions/components/InlineCategoryCell.tsx`
- `frontend/src/features/transactions/components/DeleteCustomCategoryConfirm.tsx`

**Modified (frontend):**
- [frontend/src/types/api.ts](frontend/src/types/api.ts)
- [frontend/src/services/TransactionService.ts](frontend/src/services/TransactionService.ts)
- [frontend/src/features/transactions/components/TransactionsTable.tsx](frontend/src/features/transactions/components/TransactionsTable.tsx)
- [frontend/src/features/transactions/components/TransactionsFilters.tsx](frontend/src/features/transactions/components/TransactionsFilters.tsx) (extend test file too)
- [frontend/src/views/TransactionsPage.tsx](frontend/src/views/TransactionsPage.tsx)
- [frontend/src/utils/categories.ts](frontend/src/utils/categories.ts)

## Out of scope (deferred)

- Bulk recategorization UI.
- Per-account custom categories (everything is per-user).
- Custom-category color picker (auto-cycled via `getCategoryAccent` hash for now).
- Rename of an existing custom category (delete + recreate works).
- ML retraining on user corrections.
- Sharing custom categories across users / households.
