# Dashboard Custom Date Slider MPRD

## Summary

Replace the dashboard custom start/end date inputs with a dual-thumb custom-range slider that always resolves to explicit `start_date` and `end_date` values before the UI calls the backend. The slider bounds must follow the active account filter, use the earliest in-scope transaction date as the minimum, and use today as the maximum. This work includes a small backend expansion because the current dashboard does not expose available date bounds and the cash-flow API still works off a `months` parameter instead of explicit dates.

## Product decisions

- Custom range remains a dashboard-only interaction.
- Every dashboard analytics request that depends on a period must receive two explicit dates from the UI.
- Slider minimum follows the active account filter, not global account history.
- Slider maximum is always today.
- Future dates are not supported.
- The slider is the primary control, but exact date fields remain available inside the popover for precision and accessibility.

## Current state

- Dashboard custom range UI lives in `frontend/src/features/analytics/components/CustomDateRangePicker.tsx` and currently uses two date inputs.
- Dashboard presets and custom range resolve through `frontend/src/utils/dateRanges.ts`.
- Category, spending-total, budget-summary, sankey, and net-worth paths already support explicit dates.
- Cash-flow still uses `/api/analytics/cash-flow?months=...` and does not accept `start_date` or `end_date`.
- The frontend has no account-filter-aware source for the earliest available transaction date.
- No slider primitive or slider package is currently used in the frontend.

## Scope

In scope:

- Add an analytics date-bounds endpoint.
- Update dashboard date-range resolution so presets and custom range both produce explicit dates.
- Replace the custom picker UI with a dual-thumb slider plus exact-date fallback inputs.
- Update cash-flow fetching to use explicit date windows.
- Add focused backend, hook, service, and component coverage.

Out of scope:

- Transactions page date-filter UX.
- Budgets month navigation UX.
- Changing dashboard preset labels or removing existing preset pills.
- Adding future-date support.

## Implementation plan

### Phase 1: Add analytics date bounds and explicit cash-flow range support

Goal: make the backend capable of driving a bounded slider and accepting explicit date windows for all dashboard period-based analytics.

Tasks:

- Add `GET /api/analytics/date-bounds`.
- Return `{ start_date: string | null, end_date: string | null }`.
- Apply the same authorized account filtering used by the rest of analytics endpoints.
- Resolve `start_date` as the earliest in-scope transaction date.
- Resolve `end_date` as today, even if the newest transaction is older.
- Return null bounds when the active account scope has no transactions.
- Update `/api/analytics/cash-flow` to accept `start_date` and `end_date` query params instead of the current `months`-only contract.
- Reject invalid date ordering in cash-flow the same way other date-ranged analytics endpoints do.
- Keep the cash-flow response shape unchanged so only the request contract changes.

Acceptance criteria:

- [x] `GET /api/analytics/date-bounds` returns the earliest in-scope transaction date and today for an unfiltered account scope.
- [x] `GET /api/analytics/date-bounds` returns bounds scoped to `account_ids[]` when an account filter is applied.
- [x] `GET /api/analytics/date-bounds` returns null bounds when the scoped account selection has no transactions.
- [x] `GET /api/analytics/cash-flow?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` returns a monthly series for the requested inclusive window.
- [x] Cash-flow returns `400` when `end_date < start_date`.

TDD log:

- Red: added backend route, repository, and OpenAPI tests for date-bounds plus explicit-date cash-flow behavior; initial run failed because the repository method and route contract did not exist.
- Green: added `GET /api/analytics/date-bounds`, introduced scoped earliest-date lookup, and changed cash-flow to require explicit `start_date` and `end_date`.
- Refactor: kept the endpoint response model in `backend/src/models/analytics.rs`, moved date-bounds response construction into `AnalyticsService`, and added an inclusive month-count helper for cash-flow aggregation truncation.
- Verification:
  - `cargo test -p sumurai-backend --locked get_earliest_transaction_date_for_user`
  - `cargo test -p sumurai-backend --locked get_date_bounds`
  - `cargo test -p sumurai-backend --locked get_cash_flow`
  - `cargo test -p sumurai-backend --locked openapi`
  - `cargo fmt -p sumurai-backend -p entity --check`
  - `cargo check --workspace --locked --all-targets`
  - `cargo clippy -p sumurai-backend -p entity --locked --all-targets --no-deps -- -D warnings`
  - `cargo test -p sumurai-backend --locked`

### Phase 2: Normalize dashboard range state to explicit dates

Goal: ensure the dashboard always computes and sends two dates for any selected range.

Tasks:

- Add frontend service and types for analytics date bounds.
- Fetch date bounds with the same account-filter cache key pattern used by existing analytics hooks.
- Extend date-range utilities to:
  - map presets to concrete `{ start, end }`
  - clamp custom bounds to fetched min/max bounds
  - convert between ISO dates and slider offsets
  - preserve inclusive start/end behavior
- Change dashboard hooks to consume explicit date pairs instead of relying on implicit backend defaults where applicable.
- Update cash-flow frontend service and hook to call the new explicit-date API.
- Ensure session-persisted custom bounds are clamped when account selection changes or when stored dates fall outside fetched bounds.
- Disable custom-range apply behavior when bounds are unavailable instead of emitting partial requests.

Acceptance criteria:

- [ ] Dashboard preset selection resolves to concrete `start_date` and `end_date` values before requests are sent.
- [ ] Custom range selection resolves to concrete `start_date` and `end_date` values before requests are sent.
- [ ] Cash-flow requests no longer use a `months` query param from the dashboard.
- [ ] Persisted custom ranges are clamped back into the fetched bounds after account-filter changes.
- [ ] No dashboard analytics request sends only one date for a selected range.

### Phase 3: Replace the custom date picker UI with a bounded dual-thumb slider

Goal: ship the new custom-range interaction without losing precision or accessibility.

Tasks:

- Add a small slider primitive backed by `@radix-ui/react-slider`.
- Keep the date-specific mapping logic in the analytics feature layer, not the primitive.
- Replace the current two-input custom picker layout with:
  - selected start and end labels
  - dual-thumb slider track
  - exact date fallback inputs kept in sync with slider state
  - empty or disabled state when no bounds exist
- Keep the current popover entry point from `DateRangeLabelPill`.
- Preserve keyboard support, escape-to-close behavior, and outside-click close behavior.
- Keep the popover visually aligned with the current floating chrome system.

Acceptance criteria:

- [ ] Slider minimum equals the fetched earliest available date for the active account scope.
- [ ] Slider maximum equals today.
- [ ] Thumbs cannot cross and always represent a valid inclusive date window.
- [ ] Editing fallback date inputs updates slider positions and vice versa.
- [ ] The custom-range label pill reflects the applied start/end dates after selection.
- [ ] When no bounds exist, the popover explains the unavailable state and does not emit a custom request.

### Phase 4: Regression coverage and verification

Goal: prove the new contract and interaction work across backend, hooks, and UI.

Tasks:

- Add backend tests for date-bounds and cash-flow explicit-date validation.
- Update frontend service tests for new date-bounds and cash-flow request shapes.
- Add utility tests for slider/date mapping and clamping behavior.
- Update custom picker and dashboard hook tests to cover account-filter-aware bounds, persisted-range clamping, and explicit-date requests.
- Run focused typecheck and frontend/backend test commands that cover the changed surfaces.

Acceptance criteria:

- [ ] Backend tests cover normal, filtered, empty, and invalid-range date-bounds/cash-flow cases.
- [ ] Frontend tests cover slider mapping, clamp behavior, disabled-state behavior, and explicit-date request building.
- [ ] The dashboard custom-range UI works with keyboard and pointer interaction.
- [ ] Focused verification passes on both frontend and backend surfaces touched by this change.

## Risks

- Cash-flow currently has a different request contract than the rest of dashboard analytics, so the hook and backend must change together.
- Date bounds that follow account filters can invalidate previously persisted custom ranges; the UI must clamp stored state predictably.
- Slider-only interaction would reduce precision on longer ranges, which is why exact-date fallback inputs remain in scope.
- If the backend computes earliest date by scanning a broad transaction set inefficiently, the date-bounds endpoint could become a hot path.

## Assumptions

- The dashboard should continue to own preset pills plus a custom-range popover.
- The account filter remains the source of truth for scoped analytics behavior.
- Today should be computed on the server for endpoint responses and enforced on the client for UI constraints.
- No other dashboard widget beyond the existing date-scoped analytics needs a new wire shape.

## Next actions

- Implement backend date-bounds and cash-flow request contract changes first.
- Follow with frontend hook/service normalization to explicit dates.
- Finish with the slider UI swap and focused regression coverage.
