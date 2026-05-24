# Background Auto-Categorization Plan

## Summary
- Decouple transaction auto-categorization from file import and SimpleFIN sync so new transactions appear immediately and are stored as `OTHER`.
- Add a user-scoped background categorization run launched from the Accounts page.
- Show durable progress in a stacked toast system that behaves cleanly on mobile, tablet, and desktop.

## Phase 1: Remove Inline Categorization From Ingest Paths
**Goal**

Make imports and SimpleFIN sync fast and non-blocking by removing classifier work from those write paths.

**Tasks**
- [x] Remove inline `categorize_batch` usage from the transaction import handler in `backend/src/main.rs`.
- [x] Update the import path so imported transactions are persisted with stored `category_primary = 'OTHER'`, cleared confidence, and no classifier-dependent mutation before save.
- [x] Remove inline categorization from `backend/src/services/simplefin_connection_service.rs`.
- [x] Ensure SimpleFIN-synced transactions are persisted as stored `OTHER` with cleared categorization fields before batch upsert.
- [x] Leave Plaid and Teller behavior unchanged.
- [x] Update existing backend tests that currently expect import or SimpleFIN sync to write predicted categories.
- [x] Add focused backend coverage proving imports and SimpleFIN sync succeed without invoking the categorizer.

**Acceptance Criteria**
- [x] Import requests no longer call the categorizer.
- [x] SimpleFIN sync no longer calls the categorizer.
- [x] Imported transactions persist immediately with stored category `OTHER`.
- [x] SimpleFIN-synced transactions persist immediately with stored category `OTHER`.
- [x] Existing ingest flows still return success and transaction counts as before.

**Notes**
- Imported transactions now persist with stored `OTHER` fields before save.
- SimpleFIN sync now clears stored category fields before batch upsert and cache writes.

**TDD Log**
- `cargo test --manifest-path backend/Cargo.toml import_handler_categorization_tests -- --nocapture` failed first on the new panic categorizer and later passed after the import path change and count assertions were corrected.
- `cargo test --manifest-path backend/Cargo.toml simplefin_service_tests::given_simplefin_sync_when_transactions_are_persisted_then_they_stay_other -- --nocapture` failed first on the panic categorizer and then on category field assertions before passing after the sync path was updated to clear stored category fields.
- `cargo fmt --manifest-path backend/Cargo.toml --all --check` passed after formatting.
- `cargo check --manifest-path backend/Cargo.toml` passed.

## Phase 2: Add Backend Background Auto-Categorization Job
**Goal**

Create a user-scoped background job that recategorizes eligible `OTHER` transactions without blocking imports, syncs, or page requests.

**Tasks**
- [x] Add a dedicated backend service under `backend/src/services` to own job start, status persistence, cancellation, batching, classifier execution, and terminal state handling.
- [x] Store job state in Redis with a short-lived terminal-status TTL so the UI can recover after refresh.
- [x] Define a shared status model containing `job_id`, `status`, `total`, `processed`, `updated`, `skipped`, `started_at`, `finished_at`, and `error_message`.
- [x] Enforce one active job per user.
- [x] On duplicate start while active, return active job state (`ActiveJobExists`; HTTP 409 mapping in Phase 3).
- [x] Support cooperative cancellation through a cancel flag checked between batches.
- [x] Add repository methods to count eligible transactions, fetch eligible transactions in deterministic batches, and batch-update stored category fields by transaction id.
- [x] Define eligibility strictly as stored `transactions.category_primary = 'OTHER'` with no matching `transaction_category_overrides` row.
- [x] Apply only medium/high-confidence predictions.
- [x] Leave low-confidence predictions as stored `OTHER`.
- [x] Clear the initiating session’s transactions cache and budgets cache after terminal completion.
- [x] Invalidate the initiating session’s analytics cache patterns after terminal completion.

**Acceptance Criteria**
- [x] A background run can be started without waiting for classification to finish in the request.
- [x] Only one active categorization job can exist per user.
- [x] Eligible transactions exclude rows with category overrides.
- [x] Medium/high-confidence predictions rewrite stored category fields in place.
- [x] Low-confidence predictions remain stored as `OTHER`.
- [x] Cancellation stops the run after the current batch boundary.
- [x] Terminal states are persisted long enough for the UI to read them after refresh.
- [x] Session-scoped transaction, budget, and analytics caches are invalidated on terminal completion.

**Notes**
- `AutoCategorizationService` lives in `backend/src/services/auto_categorization/` with Redis-backed job and cancel keys per user.
- Duplicate start returns `AutoCategorizationError::ActiveJobExists` for Phase 3 to map to HTTP 409.
- Repository eligibility uses stored `OTHER` plus `NOT EXISTS` on `transaction_category_overrides`.
- Cancel flag is checked only between batches; in-flight batch work completes before terminal `cancelled`.

**TDD Log**
- `cargo test --manifest-path backend/Cargo.toml auto_categorization_service_tests -- --nocapture` failed first on cancel-flag false positives and early-loop cancellation, then passed after cancel detection and between-batch checks were corrected.
- `cargo test --manifest-path backend/Cargo.toml --locked` passed (403 tests).
- `cargo fmt --manifest-path backend/Cargo.toml --all --check` passed after formatting.
- `cargo check --manifest-path backend/Cargo.toml --locked --all-targets` passed.

## Phase 3: Expose Start, Status, and Cancel APIs
**Goal**

Provide a clean HTTP contract the frontend can use to start, monitor, and cancel background categorization.

**Tasks**
- [x] Add `POST /api/transactions/auto-categorize` to start a run.
- [x] Add `GET /api/transactions/auto-categorize` to fetch latest job status.
- [x] Add `DELETE /api/transactions/auto-categorize` to cancel the active run.
- [x] Wire the new routes through the authenticated API surface in `backend/src/main.rs`.
- [x] Add request and response schemas to OpenAPI.
- [x] Ensure status responses are stable for no prior run, active run, recently completed run, cancelled run, and failed run.
- [x] Add handler-level tests for start, status, cancel, and duplicate-start rejection.

**Acceptance Criteria**
- [x] The frontend has authenticated endpoints for start, status, and cancel.
- [x] Starting while a run is active returns `409` with current job state.
- [x] Cancelling an active run returns the latest job state.
- [x] Status polling returns meaningful progress counts while active.
- [x] OpenAPI includes the new endpoint and status model shapes.

**Notes**
- `GET` returns JSON `null` when no job exists; otherwise returns `AutoCategorizationJobState`.
- `POST` returns `200` with running state; duplicate active start returns `409` with the active job body.
- `DELETE` returns `404` when no job exists; active cancel returns `200` with `cancelling` status.

**TDD Log**
- `cargo test --manifest-path backend/Cargo.toml --locked auto_categorization_handler_tests -- --nocapture` failed first (routes missing), then passed after handlers and route wiring.
- `cargo test --manifest-path backend/Cargo.toml --locked openapi_tests -- --nocapture` passed after OpenAPI schema and path registration.
- `cargo test --manifest-path backend/Cargo.toml --locked` passed (409 tests).
- `cargo fmt --manifest-path backend/Cargo.toml --all --check` passed.
- `cargo clippy --manifest-path backend/Cargo.toml --locked --all-targets --no-deps -- -D warnings` passed.

## Phase 4: Add Frontend Job Client and Accounts Hero Action
**Goal**

Add a top-level Accounts action that controls the background job and keeps app data fresh when it completes.

**Tasks**
- [x] Add frontend API types for the categorization status model in `frontend/src/types/api.ts`.
- [x] Add a service client for start, status, and cancel requests.
- [x] Add a small hook for starting a run, polling while active, cancelling, and restoring job state on page load.
- [x] Add a new hero action on `frontend/src/views/AccountsPage.tsx` with label `Auto-categorize`.
- [x] Build the action icon as a small composed glyph using `lucide-react` `BrushCleaning` plus a `Sparkles` accent so the button reads visually as a brush with sparkles, not a wand.
- [x] Keep the action styled as a peer to `Sync all` using the existing title-bar action patterns.
- [x] Swap the button label to `Cancel categorization` while a run is active.
- [x] Disable the action while offline.
- [x] Keep this action user-wide, not per bank card.
- [x] On terminal success or cancellation, invalidate or refetch frontend queries for `transactions`, `analytics`, and `budgets`.
- [x] Keep existing sync and connect actions working independently.

**Acceptance Criteria**
- [x] Accounts page shows a top-level `Auto-categorize` button with a brush-and-sparkles icon when online.
- [x] The action starts a background run instead of blocking the page.
- [x] The action switches to cancel while a run is active.
- [x] Reloading the Accounts page restores visible progress from the status endpoint.
- [x] Terminal job completion refreshes transaction- and category-dependent frontend data.

**Notes**
- `AutoCategorizationService` treats HTTP `409` start conflicts as the active job payload.
- Progress on reload is surfaced via the button `title` until Phase 5 adds stacked progress toasts.

**TDD Log**
- `npm --prefix frontend test -- AutoCategorizationService.test` passed after service and `ConflictError.body` wiring.
- `npm --prefix frontend test -- useAutoCategorization.test` passed after hook polling and terminal cache invalidation.
- `npm --prefix frontend test -- AccountsPage.test` passed after hero action wiring and hook mock coverage.
- `npm --prefix frontend run typecheck` passed.

## Phase 5: Replace Single Toast With Breakpoint-Aware Stacked Progress Toasts
**Goal**

Support a durable categorization progress toast without breaking normal transient toasts, and make the layout feel intentional on mobile, tablet, and desktop.

**Tasks**
- [x] Replace the single-message Accounts toast state with a small toast stack controller that can render multiple toasts in one portal.
- [x] Reuse `useViewportBreakpoint` so toast layout decisions follow the app’s existing `mobile`, `tablet`, and `desktop` breakpoints.
- [x] Keep one categorization progress toast as a special pinned item at the bottom of the stack while the job is `running` or `cancelling`.
- [x] Render any newer success, error, or info toasts above that pinned progress toast so they never overwrite it.
- [x] If the user manually dismisses the progress toast while the job is still active, keep it dismissed for that run instead of re-opening it on every poll.
- [x] When the job reaches `completed`, `cancelled`, or `failed`, convert the pinned progress toast into a terminal summary toast with normal auto-dismiss behavior.
- [x] Show progress content using backend counts: `processed / total`, `updated`, and `skipped`.
- [x] Keep the layout rules concrete by breakpoint:
- [x] Mobile `<768`: anchor the stack centered above the floating primary tab bar, use near-full-width cards with safe-area padding, allow wrapped copy, and keep the stack high enough to avoid colliding with bottom chrome.
- [x] Tablet `768-1023`: anchor the stack to the bottom-right, keep a medium column width, preserve extra bottom clearance so it does not sit on the reserved bottom chrome spacer, and allow 2-3 visible stacked toasts comfortably.
- [x] Desktop `>=1024`: anchor the stack to the bottom-right with the widest column, compact vertical density, and enough horizontal room for richer terminal summaries without turning into a banner.
- [x] Keep the visual style aligned with existing primitives and current shell layering rules.
- [x] Add viewport-specific tests by mocking the breakpoint hook rather than relying on raw window width only.

**Acceptance Criteria**
- [x] The categorization progress toast stays open until the user dismisses it or the job reaches a terminal state.
- [x] New toasts appear above the categorization toast instead of overwriting it.
- [x] Mobile layout clears the floating tab bar and safe-area inset.
- [x] Tablet layout clears the reserved bottom chrome spacer and remains readable without spanning the full width.
- [x] Desktop layout remains compact and anchored to the bottom-right.
- [x] Progress updates are visible while the background run is active.
- [x] Completed, cancelled, and failed states are clearly communicated.
- [x] Existing non-progress toasts still work.

**Notes**
- `ToastStack` renders transients above a pinned progress or terminal toast via `flex-col-reverse`.
- `useAccountsToastStack` tracks per-run dismiss state and terminal auto-dismiss separately from sync/import toasts.

**TDD Log**
- `npm --prefix frontend test -- autoCategorizationToastMessages` passed after message builders were added.
- `npm --prefix frontend test -- ToastStack` passed after breakpoint layout classes were wired.
- `npm --prefix frontend test -- useAccountsToastStack` passed after dismiss and terminal transition logic.
- `npm --prefix frontend test -- AccountsPage.test` passed after Accounts page integration.
- `npm --prefix frontend run typecheck` passed.

## Phase 6: Verification and Cleanup
**Goal**

Leave a complete, implementation-ready handoff that matches current architecture and repo conventions.

**Tasks**
- [x] Update backend tests in `backend/src/tests` for ingest-path behavior changes and new job, service, and handler coverage.
- [x] Update frontend tests in `frontend/tests` for Accounts action behavior, polling lifecycle, cancel behavior, toast stacking, reload recovery, and breakpoint-specific toast placement.
- [x] Update any existing Accounts stories only if needed to cover the new UI state cleanly.
- [x] Run focused validation for the touched areas: backend tests, frontend tests, and frontend typecheck.
- [x] Confirm no source comments were added and separation of concerns remains intact.

**Acceptance Criteria**
- [x] Backend tests cover ingest decoupling, job behavior, and API handlers.
- [x] Frontend tests cover Accounts action flow, stacked toast behavior, and breakpoint-specific placement.
- [x] Type shapes are consistent across backend and frontend.
- [x] The implementation follows repo rules for models, services, and tests.
- [x] No source comments are introduced.

**Notes**
- Backend coverage spans `import_handler_categorization_tests`, `auto_categorization_service_tests`, `auto_categorization_handler_tests`, and `openapi_tests`.
- Frontend coverage spans service, hook, toast stack, message builders, and Accounts page action tests.
- `AutoCategorizationJobState` / `AutoCategorizationJobStatus` mirror backend serde snake_case fields in `frontend/src/types/api.ts`.
- Accounts journey stories mock `GET/POST/DELETE /transactions/auto-categorize` so status polling on page load does not throw.

**TDD Log**
- `cargo test --manifest-path backend/Cargo.toml --locked auto_categorization` passed (12 tests).
- `cargo test --manifest-path backend/Cargo.toml --locked import_handler_categorization` passed (2 tests).
- `npm --prefix frontend test -- --testPathPatterns="autoCategorization|AutoCategorization|ToastStack|useAccountsToastStack|AccountsPage"` passed (37 tests).
- `npm --prefix frontend run typecheck` passed.

## Assumptions
- The job is user-scoped and processes all eligible transactions across all accounts for that user.
- Eligibility is based on stored category, not effective category after overrides.
- A second click during an active run is a cancel request, not an automatic restart.
- Once a run reaches `cancelled`, `completed`, or `failed`, the user may start a fresh run manually.
- Cache invalidation remains session-scoped in this change; no cross-session fanout is added.

## Risks
- The current transaction upsert path does not overwrite stored categories on conflict, so the background run needs dedicated repository update methods.
- Redis-backed status and cancellation must be designed carefully to avoid orphaned active jobs after process restarts.
- Toast placement can regress on mobile if it collides with the floating primary tab bar or safe-area spacing.
- Session-scoped cache invalidation means another live session for the same user may briefly show stale categories until refresh.

## Next Actions
- All phases in this plan are complete.
