# Next.js Migration Progress

## Plan (TDD-minded)
- [x] Inventory/mirror: map legacy routes/components/providers/tests to App Router layout without changing architecture.
- [x] Bootstrap: Next 16 + TS + Tailwind v4 + Jest/RTL lint stack.
- [x] Foundations: migrate utils/services/context/hooks with DI boundaries; ensure SSR/client guards.
 - [x] Routing/UI: wire App Router layouts/pages, navigation, and data fetching; keep client components where needed.
- [x] Styling/assets: port globals, primitives, and theming wrappers.
- [x] Tests: adapt Vitest->Jest setup; fix compatibility without rewriting assertions.
- [ ] Refactor/verify: green test run, lint clean, trim console noise, and keep React Compiler toggleable if issues surface.

## Status (at a glance)
- Runtime: Next 16 (Node) with App Router as the sole routing mechanism; React Compiler enabled behind config; Tailwind v4 wired.
- Tests: Jest+RTL single-run; Vitest globals shimed; full suite green (`npm test`) with 46 obsolete snapshots left untouched for now.
- Lint: `npm run lint` clean; custom Tailwind utility-count rule ported; `no-img-element` temporarily disabled to mirror legacy usage.
- Stability: per-test fetch/timer cleanup in `tests/setup.ts`; BudgetCalculator now uses Jest fake timers; onboarding wizard tests use Jest mocks only.
- Codebase: services/utils/contexts/hooks/components/pages migrated from legacy `frontend`; legacy `pages` moved to `src/views` to avoid Pages Router pickup; entry at `src/app/page.tsx`; App Router routes added for login/register and dashboard tabs (/dashboard, /transactions, /budgets, /accounts, /settings).

## Recently completed
- [x] Fixed open-handle warnings (Jest timers, fetch cleanup) and removed `vi` usage from onboarding wizard/BudgetCalculator suites.
- [x] Standardized boundary mocking (fetch, storage, telemetry) and kept app code real in tests.
- [x] Confirmed App Router-only direction and kept legacy structure mirrored under `src/views`.
- [x] Stabilized account-fetch defaults in tests and guarded non-array responses to avoid noisy warnings/timeouts.
- [x] Added route-aware App Router entry points (login/register and tab-specific dashboards) with initial tab/auth screen props.

## Next actions
- [ ] Refresh the 46 obsolete snapshots once UI stabilizes.
- [ ] Quiet noisy account-fetch warnings in tests by tightening the mock response shape. (partially mitigated via defaults)
- [ ] Verify `NEXT_PUBLIC_*` env wiring and keep React Compiler opt-out ready if regressions appear.

## Testing strategy & conversion notes (Jest-first)
- Use Jest APIs only (`jest.fn`, `jest.spyOn`, `jest.useFakeTimers`, `jest.setSystemTime`); avoid `vi.hoisted`/`vi.mocked` to prevent “before initialization” and redefinition errors.
- Mock modules once with `jest.mock(...)`; set return values via `mockReturnValue`/`mockImplementation` inside tests. For hooks, export simple jest fns and override returns per test; don’t re-`spyOn` ESM exports repeatedly.
- For services, prefer spying on real boundaries (e.g., `jest.spyOn(ApiClient, 'post')`) and restore in `afterEach`; keep product code unmocked.
- Globals: stub `fetch`/`location` minimally with jest mocks and restore in `afterEach`; when using `setSystemTime`, call `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`.
- Render assertions: adjust component output minimally to satisfy existing expectations rather than rewriting assertions; keep tests rendering real pages where feasible and mock only external boundaries.
