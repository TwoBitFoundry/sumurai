# Frontend Design-System Framework Refactor Plan

## Summary

Refactor the frontend around a stricter design-system pipeline while preserving Sumurai's current dark-first glass financial look and feel.

Target architecture:

`DESIGN.md` -> `designmd` DTCG export -> Style Dictionary outputs -> Tailwind v4 `@theme` CSS and TypeScript token constants -> primitives -> feature components -> thin views.

`DESIGN.md` must align with its intended purpose from the official `google-labs-code/design.md` spec: a self-contained, plain-text design-system source of truth for humans and AI agents, where YAML front matter provides normative machine-readable tokens and Markdown prose explains visual rationale and usage guidance.

## Phase 1: Token Pipeline Foundation

- Add `style-dictionary` as a frontend dev dependency, then run the project's package upgrade workflow afterward.
- Add token generation scripts that run `designmd export --format dtcg ../DESIGN.md`, compile Tailwind v4 `@theme` CSS, compile TypeScript token constants, and preserve DTCG JSON for drift inspection.
- Add generated outputs under `frontend/src/ui/tokens/generated/`: `theme.css`, `tokens.ts`, and `tokens.dtcg.json`.
- Import generated `theme.css` from `frontend/src/app/globals.css`.
- Remove custom design-value authority from `frontend/src/ui/tokens/tailwind-bridge.js`; keep `frontend/tailwind.config.js` only for content scanning and dark mode until it can be simplified.
- Add a drift check script that fails when generated artifacts are stale.

Acceptance criteria:

- One repeatable npm script regenerates DTCG, Tailwind `@theme` CSS, and TypeScript tokens from `DESIGN.md`.
- Generated files are clearly treated as generated artifacts and are not manually edited.
- Tailwind custom Sumurai tokens are available through CSS-first `@theme` variables.
- The old JS Tailwind token bridge is no longer authoritative.
- Drift check fails after changing `DESIGN.md` without regenerating artifacts.
- `design:lint`, token generation, focused token tests, and typecheck pass.

Completion notes:

- Added `frontend/scripts/generate-design-tokens.mjs` and `frontend/scripts/check-design-tokens-drift.mjs` with shared pipeline helpers.
- Generated `frontend/src/ui/tokens/generated/theme.css`, `frontend/src/ui/tokens/generated/tokens.ts`, and `frontend/src/ui/tokens/generated/tokens.dtcg.json` from `DESIGN.md`.
- Imported the generated theme into `frontend/src/app/globals.css` and removed the Tailwind bridge from `frontend/tailwind.config.js`.
- Removed `frontend/src/ui/tokens/tailwind-bridge.js` so the generated theme is the only active Tailwind design source.

TDD log:

- `npm --prefix frontend test -- --runInBand frontend/tests/scripts/designTokensGeneration.test.ts` failed until the generator and drift scripts were added, then passed.
- `npm --prefix frontend run design:generate`
- `npm --prefix frontend run design:lint`
- `npm --prefix frontend run design:drift`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test`

## Phase 2: DESIGN.md Contract Refactor

- Rewrite `DESIGN.md` so YAML front matter contains normative token values and Markdown body contains human-readable rationale and agent guidance.
- Keep front matter within spec-shaped groups: `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, and `components`.
- Use component tokens only for reusable design roles with valid, simple properties such as `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, and `width`.
- Do not encode Tailwind class arrays, CVA recipes, one-off view styling, or implementation-only utility strings in `DESIGN.md`.
- Organize prose in canonical section order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, and Do's and Don'ts.
- Keep implementation recipes in primitives, feature components, or generated token artifacts.

Acceptance criteria:

- `DESIGN.md` reads as a design-system source of truth for humans and agents.
- Tokens are normative values; prose explains why and how to apply them.
- `DESIGN.md` no longer acts as a Tailwind class warehouse.
- Front matter validates with `designmd lint`.
- Component tokens use stable semantic roles and simple component properties.
- Markdown sections appear in the spec's canonical order.
- The current Sumurai identity remains described clearly enough for another agent to recreate the look.
- `designmd export --format dtcg` and `designmd export --format css-tailwind` both succeed.

Completion notes:

- Rewrote `DESIGN.md` into canonical prose sections with a normative YAML contract and removed implementation-recipe language from the body.
- Kept the token values and component roles aligned with the exported design contract so the generator pipeline remains stable.

TDD log:

- Added `frontend/tests/scripts/designMdContract.test.ts` to verify canonical section order, prose-only guidance, and successful design CLI wrappers.
- Ran `npm --prefix frontend test -- --runInBand frontend/tests/scripts/designMdContract.test.ts`.
- Ran `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, and `npm --prefix frontend run design:drift`.
- Ran `npm --prefix frontend run typecheck` and `npm --prefix frontend test`.

## Phase 3: Token Contract Cleanup

- Refactor `frontend/src/ui/tokens/index.ts` into a compatibility facade over generated tokens plus curated recipe exports.
- Move reusable class recipes out of generated and design contract files and into primitives.
- Move feature-specific recipes closer to feature components.
- Keep exported token names stable where practical.
- Update tests to assert semantic alignment with generated tokens instead of exact large Tailwind class arrays.

Acceptance criteria:

- Repeated raw token values are not manually duplicated across `DESIGN.md`, `index.ts`, `tailwind-bridge.js`, and `globals.css`.
- `@/ui/tokens` consumers continue to compile.
- Token tests verify generated-token alignment and stable public roles.
- Raw hex, radius, spacing, typography, and chart values originate from generated tokens or approved primitive recipes.
- `design:lint`, DTCG export, Tailwind export, token tests, and typecheck pass.

Completion notes:

- Split shared primitive recipes into [frontend/src/ui/primitives/tokenRecipes.ts](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/ui/primitives/tokenRecipes.ts) and moved onboarding and budget-local recipes into component or feature-local modules.
- Wired [frontend/src/ui/tokens/index.ts](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/ui/tokens/index.ts) to the generated token contract for raw values while preserving the public `designTokens` facade.
- Updated token tests to assert generated-token alignment and refreshed the EmptyState snapshot after the recipe split.

TDD log:

- Added and ran `frontend/tests/ui/tokens/designTokens.test.ts` against generated tokens and stable recipe roles.
- Updated `frontend/tests/ui/primitives/__snapshots__/EmptyState.test.tsx.snap` after the shared empty-state recipe changed.
- Ran `npm --prefix frontend test -- --runInBand frontend/tests/ui/tokens/designTokens.test.ts frontend/tests/scripts/designMdContract.test.ts`.
- Ran `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, `npm --prefix frontend run design:drift`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend test`.

## Phase 4: Primitive Layer Modernization

- Keep CVA as the variant system.
- Move allowed visual combinations into primitive-owned variants and compound variants.
- Replace large visual `className` override patterns with explicit primitive props when the visual role is reusable.
- Add Radix incrementally for complex accessible behavior, starting with refactoring `Modal` to Radix Dialog while preserving the existing API where practical.
- Add wrapped Radix primitives for menu, tabs, tooltip, checkbox, switch, popover, and select only as needed by existing or near-term UI.
- Replace `components/ui/Card.tsx` usage with `GlassCard` or a short-lived primitive alias.
- Replace `components/ui/Table.tsx` with a primitive table or transaction-specific feature table component.
- Remove source comments from touched primitive files.

Acceptance criteria:

- Shared visual chrome lives in `frontend/src/ui/primitives`, not views.
- Core primitives expose small, variant-driven APIs.
- `Modal` has accessible dialog behavior, focus handling, keyboard dismissal, and backdrop behavior covered by tests.
- Legacy `components/ui/Card.tsx` and `components/ui/Table.tsx` are removed or reduced to temporary compatibility aliases with no new usage.
- Primitive tests cover default, variant, disabled/loading, invalid, and dark-mode-relevant behavior.
- No touched source file gains comments.
- Focused primitive tests and typecheck pass.

Completion notes:

- Replaced `Modal` with a Radix Dialog-backed primitive in [frontend/src/ui/primitives/Modal.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/ui/primitives/Modal.tsx) while keeping the existing `isOpen`, `onClose`, `labelledBy`, `description`, and backdrop control props.
- Added the Radix dialog package to [frontend/package.json](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/package.json) and refreshed the lockfile.
- Updated [frontend/src/views/SettingsPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/SettingsPage.tsx) to provide an explicit modal title binding for the delete-account dialog.
- Replaced legacy card usage in [frontend/src/views/DashboardPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/DashboardPage.tsx) and [frontend/src/views/BudgetsPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/BudgetsPage.tsx) with `GlassCard`.
- Removed [frontend/src/components/ui/Card.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/components/ui/Card.tsx), [frontend/src/components/ui/Table.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/components/ui/Table.tsx), [frontend/tests/components/ui/Card.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/components/ui/Card.test.tsx), and [frontend/tests/components/ui/Table.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/components/ui/Table.test.tsx).

TDD log:

- Added [frontend/tests/ui/primitives/Modal.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/ui/primitives/Modal.test.tsx) to cover accessible semantics, focus handoff, escape dismissal, backdrop dismissal, and backdrop lockout.
- Updated [frontend/tests/components/ProviderMismatchModal.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/components/ProviderMismatchModal.test.tsx) to query the portaled dialog in `document.body`.
- Ran `npm --prefix frontend test -- --runInBand frontend/tests/ui/primitives/Modal.test.tsx`.
- Ran `npm --prefix frontend test -- --runInBand frontend/tests/ui/primitives/Modal.test.tsx frontend/tests/components/ProviderMismatchModal.test.tsx frontend/tests/components/Accounts/DisconnectModal.test.tsx frontend/tests/integration/SessionManager.test.tsx frontend/tests/pages/SettingsPage.test.tsx`.
- Ran `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend test`.

## Phase 5: Feature Component Extraction

- Move repeated visual structures out of views and into feature components for accounts provider selection, provider loading/error surfaces, connection summary panels, budget utilization summary, month controls, budget list toolbar, budget card actions, transaction filters/table chrome, and dashboard widget shells.
- Keep views responsible only for page orchestration, state wiring, route/tab conditionals, and feature composition.
- Replace feature-specific buttons such as `ConnectButton` with the shared `Button` primitive using a `connect` variant or a small behavior-only wrapper.
- Remove raw colors, arbitrary gradients, one-off shadows, and bespoke rounded values from views unless explicitly approved as local exceptions.

Completion notes:

- Extracted provider selection and connection summary chrome into [frontend/src/features/plaid/components/ProviderSelectionPanel.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/plaid/components/ProviderSelectionPanel.tsx) and [frontend/src/features/plaid/components/AccountsSummaryStats.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/plaid/components/AccountsSummaryStats.tsx).
- Moved the budget utilization summary and month toolbar into [frontend/src/features/budgets/components/BudgetSummaryCard.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/budgets/components/BudgetSummaryCard.tsx) and [frontend/src/features/budgets/components/BudgetToolbar.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/budgets/components/BudgetToolbar.tsx).
- Moved transaction filter chrome into [frontend/src/features/transactions/components/TransactionsToolbar.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/transactions/components/TransactionsToolbar.tsx).
- Wrapped the dashboard widget shells in [frontend/src/features/analytics/components/DashboardChartCard.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/analytics/components/DashboardChartCard.tsx).
- Refactored [frontend/src/features/plaid/components/ConnectButton.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/features/plaid/components/ConnectButton.tsx) onto the shared `Button` primitive with the `connect` variant.
- Updated [frontend/src/views/AccountsPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/AccountsPage.tsx), [frontend/src/views/BudgetsPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/BudgetsPage.tsx), [frontend/src/views/TransactionsPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/TransactionsPage.tsx), and [frontend/src/views/DashboardPage.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/src/views/DashboardPage.tsx) to compose the new feature components instead of carrying the chrome inline.

TDD log:

- Added [frontend/tests/features/plaid/components/ProviderSelectionPanel.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/plaid/components/ProviderSelectionPanel.test.tsx) and [frontend/tests/features/plaid/components/AccountsSummaryStats.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/plaid/components/AccountsSummaryStats.test.tsx) for provider and connection chrome.
- Added [frontend/tests/features/budgets/components/BudgetSummaryCard.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/budgets/components/BudgetSummaryCard.test.tsx) and [frontend/tests/features/budgets/components/BudgetToolbar.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/budgets/components/BudgetToolbar.test.tsx) for budget summary and month control behavior.
- Added [frontend/tests/features/transactions/components/TransactionsToolbar.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/transactions/components/TransactionsToolbar.test.tsx) and [frontend/tests/features/analytics/components/DashboardChartCard.test.tsx](/Users/kodybuss/Repos/two-bit-foundry/sumurai/frontend/tests/features/analytics/components/DashboardChartCard.test.tsx) for transaction chrome and dashboard widget shells.
- Ran `npm --prefix frontend test -- --runInBand frontend/tests/features/plaid/components/ProviderSelectionPanel.test.tsx frontend/tests/features/plaid/components/AccountsSummaryStats.test.tsx frontend/tests/features/plaid/components/ConnectButton.test.tsx frontend/tests/features/plaid/components/ConnectionsList.test.tsx frontend/tests/features/budgets/components/BudgetSummaryCard.test.tsx frontend/tests/features/budgets/components/BudgetToolbar.test.tsx frontend/tests/features/budgets/components/BudgetProgress.test.tsx frontend/tests/features/transactions/components/TransactionsToolbar.test.tsx frontend/tests/features/analytics/components/DashboardChartCard.test.tsx`.
- Ran `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, and `npm --prefix frontend test`.

Acceptance criteria:

- `frontend/src/views/*` files mostly compose layouts, hooks, and feature components.
- Accounts, budgets, transactions, and dashboard repeated UI chrome is owned by feature components or primitives.
- New components live in existing `features`, `components`, or `layouts` folders according to current separation rules.
- `ConnectButton` no longer owns unique visual styling separate from `Button`.
- Searches for raw hex, arbitrary gradients, arbitrary shadows, and bespoke rounded values in views return none or only approved exceptions.
- Existing page behavior remains unchanged in tests.
- Focused feature tests, affected page tests, full frontend test suite, and typecheck pass.

## Phase 6: Guardrails And Visual Coverage

Scope recap:

- Add lint/check scripts that block new raw hex values, arbitrary gradients, arbitrary shadows, and token drift outside approved files.
- Add tests under `frontend/tests` for token generation/drift, primitive variants, public primitive prop compatibility, and extracted feature component rendering.
- Add Storybook for primitives and key feature components.
- Add stories for light/dark, loading, empty, invalid, disabled, overflow, and dense-data states.
- Add visual regression through Chromatic or Playwright screenshots.

Completion notes:

- Guardrails: `frontend/scripts/check-raw-styling.mjs`, drift via `design:drift`, DESIGN.md lint via `design:lint`, exports via `design:export:*`; orchestrated by `design:guard`. Boundary tests include `frontend/tests/scripts/rawStylingGuard.test.ts` and existing token/design tests under `frontend/tests/`.
- Root `package.json` runs `frontend:design` as part of `precommit` so token drift and raw styling regressions fail before merge alongside typecheck, lint, Jest, and `next build`.
- Storybook 10 with primitives and selected feature stories; `@storybook/addon-mcp` exposes MCP at `/mcp` when the dev server is running; see `AGENTS.md` for Cursor MCP usage.
- Playwright visual regression: `frontend/playwright.visual.config.ts` (Chromium, static Storybook on port 6007, iframe URLs use `/iframe?id=` because `serve` strips query strings on `/iframe.html` redirects). Snapshots live under `frontend/tests/visual/storybook.visual.spec.ts-snapshots/` with separate `darwin` and `linux` baselines; refresh Linux with `mcr.microsoft.com/playwright:v1.59.1-jammy` and `npm run test:visual:update` if CI screenshots drift.
- CI job `frontend` in `.github/workflows/ci.yml` runs typecheck, lint, `design:guard`, Jest, production build, Playwright Chromium install, and `test:visual`.

Agent validation sequence (Phase 6 complete when all succeed):

1. `npm --prefix frontend run design:guard`
2. `npm --prefix frontend test`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`
5. `npm run frontend:visual` from repo root (or `npm --prefix frontend run test:visual`)
6. Optionally start `npm --prefix frontend run storybook` and confirm Storybook MCP tools respond at `http://localhost:6006/mcp` per `AGENTS.md`
7. `npm run precommit` at repo root for the full backend plus frontend gate used locally before push

Acceptance criteria:

- CI and precommit catch token drift and disallowed raw styling outside approved files (`design:guard` on precommit; same in CI).
- Storybook runs locally and includes the main primitives plus selected account, budget, transaction, and dashboard feature components.
- Visual regression covers primitive states and at least one full-page smoke path.
- A student agent can run the validation sequence above and consult `AGENTS.md` for Storybook MCP behavior.
- Final validation passes: `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run build`, plus `npm run frontend:visual` when validating screenshots.

## Assumptions

- General look and feel must remain the same even if implementation changes broadly.
- No `.env` files are read or written.
- No source comments are added.
- Plan documents may mention phases; implementation material outside plan documents should not.
- Existing frontend tests remain the primary behavioral safety net.
- External design-system references are the official `google-labs-code/design.md` repo and spec, Tailwind v4 theme variables, Style Dictionary DTCG support and transforms, Radix accessibility guidance, and Chromatic visual testing guidance.

## Risks

- Token generation may initially change utility names or output shapes, so compatibility tests must protect existing imports while generated artifacts stabilize.
- Moving class recipes out of `frontend/src/ui/tokens/index.ts` can create broad snapshot churn if done without preserving visual output.
- Radix migration can alter focus behavior and markup structure, so modal and menu tests should verify user behavior rather than exact DOM shape.
- Guardrails that scan raw styling can produce false positives unless approved generated, primitive, and CSS files are explicitly allowlisted.
- Storybook and visual regression dependencies can increase frontend install and CI time, so add them after the token and primitive contracts are stable.

## Next Actions

- Phase 6 guardrails, Storybook, MCP addon, and Playwright visuals are integrated; keep running the Phase 6 validation sequence in `docs/frontend-design-system-framework-refactor-plan.md` when changing `DESIGN.md`, tokens, primitives, or Storybook stories.
- When optional native deps fail locally (`rolldown`, `lightningcss`), run `npm ci` in `frontend/` before Storybook or Next builds.
