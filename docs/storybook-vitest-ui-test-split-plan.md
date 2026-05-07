# Storybook Vitest UI Test Split Plan

## Summary

Set up Storybook's Vitest addon as the primary UI/UX test runner, while keeping Jest focused on UI business logic and non-visual contracts. Use a staged migration so the repo adopts browser-mode component testing without trying to consolidate all Jest tests at once.

Reference docs:

- Storybook Vitest addon: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon/index
- Storybook play functions: https://storybook.js.org/docs/writing-stories/play-function

## Phase 1: Runner Setup And Test Ownership

Status: complete

### Implementation

- Add Storybook Vitest support using the official Storybook addon path:
  - Add `@storybook/addon-vitest`, `vitest`, and `@vitest/browser-playwright`.
  - Run the built-in package update step after adding packages.
  - Register `@storybook/addon-vitest` in `frontend/.storybook/main.ts`.
- Add a Storybook Vitest config that:
  - Uses Playwright Chromium browser mode.
  - Uses project name `storybook`.
  - Points at `frontend/.storybook`.
  - Runs only stories tagged with `test`.
  - Keeps Storybook docs parsing disabled unless required by the generated config.
- Add scripts:
  - `frontend/package.json`: `test:storybook`, `test:storybook:watch`.
  - root `package.json`: `frontend:storybook-test`.
- Keep existing Storybook Playwright visual and runtime tests unchanged.
- Update `AGENTS.md` Testing guidance:
  - Jest owns services, domain logic, hooks, API contracts, observability, mocks, setup, token tests, script guards, and business rules.
  - Storybook Vitest owns rendered UI states, user interactions, form validation display, loading/error/disabled states, callback outcomes, and browser-only component behavior.
  - Playwright visual owns screenshot regression only.
- Keep current Storybook a11y behavior non-blocking with `a11y: { test: 'todo' }`.

### Acceptance Criteria

- `npm --prefix frontend run test:storybook` exists and runs Storybook-tagged stories through Vitest browser mode.
- `npm --prefix frontend run test:storybook:watch` exists for local debugging.
- Root `npm run frontend:storybook-test` delegates to the frontend Storybook Vitest script.
- Storybook still builds with `npm --prefix frontend run storybook:build`.
- `AGENTS.md` clearly explains where future tests belong.
- No existing Jest, visual, or runtime Storybook tests are removed in this phase.

### Notes

- Added a project-level `!test` tag override in `.storybook/preview.tsx` so the built-in Storybook `test` tag becomes opt-in for later story tagging.
- Added a lightweight browser-mode setup file for `jest-dom` matchers in Storybook Vitest runs.
- The new Storybook Vitest script now skips untagged stories until Phase 2 adds `test` tags to the selected UI stories.

### TDD Log

- Red: `npm --prefix frontend run test:storybook` initially executed every story because Storybook applies the built-in `test` tag by default.
- Green: added `frontend/vitest.config.ts`, `frontend/.storybook/vitest.setup.ts`, the addon registration, and the preview-level `!test` override.
- Verify: `npm --prefix frontend run test:storybook`, `npm --prefix frontend run storybook:build`, `npm run frontend:storybook-test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend test`.

## Phase 2: Seed Stable Storybook UI Tests

Status: complete

### Implementation

- Add `test` tags only to stable stories that should enter the new runner.
- Start with clear UI/UX candidates that already have stories:
  - `Button`
  - `Input`
  - `GlassCard`
  - `EmptyState`
  - `AppTitleBar`
  - `HeaderAccountFilter`
  - `ProviderMismatchModal`
  - `ConnectAccountStep`
  - budget feature components with existing stories
  - Plaid feature components with existing stories
  - `TransactionsToolbar`
  - `DashboardChartCard`
  - existing auth stories
- Add or expand `play` functions for real user-facing behavior:
  - Button click calls callback.
  - Disabled/loading controls do not allow invalid actions.
  - Form fields accept input and show validation states.
  - Toolbar/filter controls call their callbacks with expected user-visible outcomes.
  - Modal close/cancel actions call callbacks.
  - Auth validation stories show inline validation and authentication error states.
- Use `storybook/test` imports for `expect`, `fn`, `userEvent`, and `waitFor` where practical.
- Prefer Storybook's `canvas` query API over global DOM queries.

### Acceptance Criteria

- Storybook Vitest runs a small but meaningful stable set of stories.
- Each tagged story either smoke-renders intentionally or has a focused `play` test.
- Added play tests assert observable UI behavior, not implementation details or class names.
- Existing visual matrix story IDs remain valid.
- `npm --prefix frontend run test:storybook` passes.
- `npm --prefix frontend test` still passes.

### Notes

- Tagged and added interaction tests for the first stable UI batch:
  - `Auth`
  - `Button`
  - `Input`
  - `BudgetToolbar`
  - `TransactionsToolbar`
  - `ProviderSelectionPanel`
  - `ProviderMismatchModal`
  - `ConnectAccountStep`
- Retired the duplicated Jest UI specs for `Button`, `Input`, `BudgetToolbar`, `TransactionsToolbar`, and `ProviderSelectionPanel` after the Storybook coverage passed.
- Storybook MCP a11y output is being treated as advisory for now per user direction; the current story changes still validated cleanly for interaction behavior.

### TDD Log

- Red: MCP story tests surfaced interaction assumptions that needed story-level adjustments for controlled search input state and modal targeting.
- Green: added tagged story coverage for auth, budget toolbar, provider selection, and the existing primitive / onboarding / toolbar stories.
- Verify: `run-story-tests` for the changed stories passed for interaction behavior; a11y warnings were observed and intentionally deferred.

### Result

- Storybook Vitest now covers the intended stable UI batch.
- Jest no longer owns the redundant component-level DOM checks for the migrated components.
- The remaining Jest coverage is still focused on business logic, hooks, contracts, and service behavior.

## Phase 3: Move Clear Jest UI Coverage

Status: complete

### Implementation

- Remove or shrink only Jest tests whose behavior is now covered by tagged Storybook stories.
- First-pass Jest migration candidates:
  - Primitive snapshot/class-name tests for `Button`, `Input`, `GlassCard`, `EmptyState`, `AppTitleBar`, `Badge`, `GradientShell`, `Modal`, `Select`, and `AppFooter`.
  - Pure component render/callback tests for budget, Plaid, analytics, transactions toolbar, onboarding step, header filter, and provider mismatch components.
- Keep Jest coverage when the test validates:
  - Hook state transitions.
  - API request/response shape.
  - Storage/session/token behavior.
  - Domain transformations.
  - Service retry/error handling.
  - Observability behavior.
  - Test infrastructure.
- Do not perform broad Jest consolidation yet.
- Do not remove `integration/Auth.test.tsx`, `BudgetsIntegration.test.tsx`, `PlaidSyncIntegration.test.tsx`, `SessionManager.test.tsx`, or `pages/SettingsPage.test.tsx` unless each assertion is explicitly split into Storybook UI coverage plus retained Jest business/API coverage.

### Acceptance Criteria

- Any deleted Jest assertion has equivalent or better Storybook Vitest coverage.
- Jest no longer owns class-name snapshots for UI presentation where Storybook visual or interaction coverage is more appropriate.
- Jest remains green with no loss of service/domain/hook/API contract coverage.
- Storybook Vitest remains green after each migration batch.
- The diff shows a net reduction in Jest UI/DOM tests without reducing business-logic coverage.

### Notes

- Removed the Jest presentation tests and snapshots for:
  - `AppTitleBar`
  - `EmptyState`
  - `GlassCard`
- Kept the Storybook stories as the source of truth for the rendered states and the authenticated `AppTitleBar` interactions.
- Adjusted `frontend/vitest.config.ts` to bind the Vitest browser API to `0.0.0.0` so the browser-mode runner can start in the sandboxed desktop environment.
- `npm --prefix frontend run test:storybook` passes when run outside the sandboxed shell.

### TDD Log

- Red: the existing Jest files for these primitives were mostly render, class, and snapshot assertions that duplicated Storybook coverage.
- Green: deleted the redundant Jest specs and snapshot files for the three primitives, then kept the Storybook stories as the replacement contract.
- Verify: `npm --prefix frontend run test:storybook` (outside sandbox), `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`.

### Result

- The Jest UI surface is smaller, and the remaining checks are concentrated in components that still need explicit migration decisions.
- Storybook Vitest now covers the primitive presentation states that were removed from Jest.

## Phase 4: Validation, Runtime Decision, And Handoff Notes

### Implementation

- Run validation:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run storybook:build`
  - `npm --prefix frontend run test:storybook`
  - `npm --prefix frontend run test:storybook-runtime`
  - `npm --prefix frontend run test:visual` if stories or visual states changed
- Measure Storybook Vitest runtime.
- Gate policy:
  - If Storybook Vitest is close to the current Jest baseline of about 26 seconds and stable, add it to `npm run precommit`.
  - If it is materially slower or flaky, leave it as an explicit script and document that it should run in CI/manual workflows until tags or workers are tuned.
- Leave a short migration note in the final implementation summary listing:
  - Tests moved from Jest to Storybook.
  - Jest tests intentionally retained.
  - Any case-by-case integration tests deferred.

### Acceptance Criteria

- All required validation commands pass, or any failure is clearly explained with the exact failing command.
- The final implementation preserves the separation:
  - Storybook Vitest for UI/UX behavior.
  - Jest for UI business logic and contracts.
  - Playwright visual for screenshots.
- Precommit includes Storybook Vitest only if measured runtime and stability justify it.
- Deferred Jest consolidation work is explicitly called out as follow-up, not mixed into this implementation.

## Assumptions

- Prefer Storybook Vitest browser-mode testing over the older Jest-based Storybook test runner.
- Do not perform broad Jest consolidation in this work.
- Do not remove existing Playwright visual/runtime coverage in the first pass.
- Do not add inline source tests or source comments.
- Do not read or write `.env` files.

## Risks

- Storybook Vitest may be slower than Jest if too many stories are tagged at once.
- Some current Jest UI tests mix visual behavior with API or hook contracts and must be split carefully.
- Story-level fetch overrides can become brittle; prefer controlled props, story fixtures, or true boundary mocks when available.
- Browser-mode Vitest may need worker tuning in CI if story count grows quickly.

## Next Actions

- Implement Phase 1 first and measure the empty or lightly tagged runner.
- Tag and migrate only the clearest UI/UX stories in Phase 2 before deleting any Jest coverage.
- Keep a short migration log in the implementation summary so later Jest consolidation has a clear starting point.

## Student Agent Rules

- Do not read or write `.env` files.
- Do not add source comments.
- Do not add tests inline with source files.
- Keep stories beside existing components under `frontend/src`.
- Keep Jest tests under `frontend/tests`.
- Prefer editing existing stories before creating new ones.
- Mock only true external boundaries.
- Do not remove a Jest test until its purpose is clearly covered elsewhere.
- Use `rg` to find nearest existing patterns before editing.
