# Sticky Insights Shared Component MPRD

## Summary

Implement sticky insights behavior through a small shared component family instead of per-panel sticky logic. All existing insights panels stay sticky as one unit at all breakpoints, whether collapsed or expanded.

The implementation should use:

- one shared sticky insights shell for every insights panel
- one shared expandable insights primitive for balances and budgets
- the existing flat transaction insights layout on top of the same shared shell

This work must preserve the current visual identity, keep the full panel as the sticky unit in every state, and centralize sticky positioning, clipping, and offset behavior in one reusable layer.

## Current State

- `BalancesInsightsPanel` and `BudgetInsightsPanel` each build their own gradient shell plus expandable body on top of `InsightsPanelShell`.
- `TransactionInsightsPanel` uses `InsightsPanel`, which wraps `InsightsPanelShell` for a flat, non-collapsible panel layout.
- `InsightsPanelShell` currently owns the accent gradient, clipped rounded shell, and hover ring, but it is not designed for sticky behavior.
- Sticky behavior needs to be consistent across balances, budgets, and transactions.
- The whole rendered insights card must remain the sticky unit in both collapsed and expanded states.

## Goals

- Centralize sticky insights behavior in shared UI code.
- Keep balances, budgets, and transactions visually consistent where the structure is shared.
- Preserve feature-specific content, copy, and interaction behavior.
- Avoid a monolithic prop-heavy component that mixes unrelated panel behaviors.

## Non-Goals

- Do not redesign the transaction insights panel into a summary/detail layout.
- Do not change backend APIs or response shapes.
- Do not change the business logic that computes balances, budgets, or transactions insights.
- Do not introduce a new global design-token role unless implementation reveals a concrete gap in the existing shell treatment.

## Milestone 1: Shared sticky insights shell

### Goal

Create a shared sticky shell that every insights panel can use without duplicating top offset, z-index, clipping, gradient, or overflow behavior.

### Tasks

- Introduce a shared sticky-aware shell at the widget layer, either by extending `InsightsPanelShell` or adding a thin shared wrapper above it.
- Keep sticky positioning on the outer shell element and move any clipping needed for rounded surfaces to an inner layer if required to preserve sticky behavior.
- Centralize sticky offset logic so every breakpoint uses the same source of truth.
- Align the offset with the existing app chrome:
  - safe-area top inset
  - sticky `AppTitleBar` height
  - current page top spacing at mobile, `md`, and `lg`
- Preserve the existing accent gradient, glass surface, and hover ring behavior.
- Ensure the shell supports both flat panels and expandable panels without feature-specific branching in the shell itself.

### Acceptance Criteria

- [x] A shared sticky insights shell exists and is reusable by balances, budgets, and transactions.
- [x] Sticky behavior applies to the entire rendered panel, not only a summary subsection.
- [x] The sticky shell works at all breakpoints.
- [x] The sticky shell pins below `AppTitleBar` without hiding under it.
- [x] Gradient, rounded corners, and hover ring styling remain visually intact.

## Milestone 2: Shared expandable insights primitive

### Goal

Create a shared expandable insights primitive for the balances and budgets pattern without forcing transactions into the same interaction model.

### Tasks

- Introduce a shared expandable panel primitive for the current balances/budgets structure.
- Keep the primitive focused on shared behavior:
  - header layout container
  - expand/collapse trigger wiring
  - body reveal container
  - divider and collapsed/expanded surface handling
- Keep balances- and budgets-specific metrics, copy, and row markup outside the primitive and passed in through composition.
- Ensure the entire expandable panel remains one sticky unit when collapsed and when expanded.
- Avoid introducing a large prop matrix for unrelated panel behaviors.

### Acceptance Criteria

- [x] Balances and budgets use the same expandable insights primitive.
- [x] Balances and budgets remain one sticky unit in both collapsed and expanded states.
- [x] Feature-specific metric markup stays in feature-owned components.
- [x] Transactions is not forced into the expandable primitive.

## Milestone 3: Feature panel migration

### Goal

Move all existing insights panels onto the shared component family while preserving each panel’s current content and interaction model.

### Tasks

- Migrate `BalancesInsightsPanel` to the shared sticky shell plus shared expandable primitive.
- Preserve balances-specific behavior:
  - current net summary structure
  - YTD header/body content rules
  - account-group detail rows
  - reset-key and flip-card behavior
- Migrate `BudgetInsightsPanel` to the shared sticky shell plus shared expandable primitive.
- Preserve budgets-specific behavior:
  - current totals/progress header layout
  - empty-state behavior
  - fixed-cost and runway detail content
  - reset-key behavior
- Migrate `TransactionInsightsPanel` to the shared sticky shell while keeping its current flat panel structure.
- Preserve transactions-specific behavior:
  - existing state label/header behavior
  - current insight-card layout
  - flip interactions
  - loading behavior

### Acceptance Criteria

- [x] Balances uses the shared shell and shared expandable primitive.
- [x] Budgets uses the shared shell and shared expandable primitive.
- [x] Transactions uses the shared shell and keeps its current flat layout.
- [x] Existing panel-specific interactions still work after migration.
- [x] No panel introduces a separate sticky summary region.

## Milestone 4: Verification and regression coverage

### Goal

Verify that the shared component family behaves correctly across breakpoints and panel states without breaking existing interactions.

### Tasks

- Update shared component tests for sticky structure, offset classes, and overflow/clipping behavior.
- Update feature panel tests to verify sticky behavior remains attached to the entire panel.
- Add or update Storybook coverage for:
  - balances collapsed
  - balances expanded
  - budgets collapsed
  - budgets expanded
  - transactions standard state
- Run focused validation:
  - `bun --cwd=frontend test`
  - `bun --cwd=frontend run typecheck`
- Perform browser verification across breakpoints for real scroll behavior.

### Acceptance Criteria

- [x] Component tests verify balances, budgets, and transactions use the shared sticky structure.
- [ ] Tests verify balances and budgets remain one sticky unit when expanded.
- [x] Tests verify transactions remains one sticky unit in its flat layout.
- [x] Storybook coverage exists for the main collapsed and expanded states.
- [ ] Browser verification confirms correct sticky behavior at all breakpoints.

## Important Implementation Notes

- Keep the sticky behavior and shell treatment in shared UI code, not in page views.
- Keep views focused on composition and data flow.
- Keep feature-specific content rendering inside the owning feature components.
- Prefer composition over configuration. The shared primitives should expose structure, not encode feature-specific copy or metrics.
- Do not split sticky behavior between separate summary and detail regions.
- Do not add comments to source code.

## Risks

- Sticky positioning can fail if clipping or overflow stays on the sticky element instead of an inner surface.
- Breakpoint-specific spacing can drift if the sticky offset is not derived from existing layout values.
- Over-generalizing the shared panel API can make the abstraction harder to maintain than the current duplication.
- Visual regressions are likely if the shell migration changes rounded clipping or divider placement during expanded states.

## Assumptions

- Scope is limited to the existing repo insights panels: balances, budgets, and transactions.
- Sticky behavior applies at all breakpoints.
- The full rendered insights card is the sticky unit in every state.
- Transactions remains a flat panel and is not converted into an expandable panel.
- Existing backend and domain logic remain unchanged.

## Next Actions

- Build the shared sticky shell first and prove sticky behavior with one panel before completing the other migrations.
- Migrate balances and budgets onto the shared expandable primitive.
- Migrate transactions onto the shared sticky shell.
- Complete regression tests and breakpoint browser verification before implementation handoff is considered complete.

## Validation Notes (2026-06-11)

Validated on branch `feat/sticky-insights` against uncommitted implementation.

**Milestone 1–3:** Complete. `InsightsPanelShell` centralizes sticky offset (`insightsPanel.stickyShell` in `recipes.ts`: safe-area + `3.5rem` title bar + `AppLayout` page padding at mobile/md/lg). Clipping lives on the inner surface; sticky is on the outer `<section>`. Balances and budgets compose `InsightsExpandablePanel` inside the shell; transactions uses flat `InsightsPanel` → same shell. No separate sticky summary regions.

**Milestone 4:** Mostly complete. `InsightsPanelShell.test.tsx` plus panel tests assert `sticky`, `z-30`, offset classes, and inner `overflow-hidden`. Typecheck passes. Storybook: balances `CollapsedByDefault` / `CollapseAndExpand`; budgets stories expand from default collapsed; transactions `StateA` and related states. Four keyboard-activation tests fail with a Bun/jest-dom `ERR_INVALID_THIS` matcher error (click-based expand/collapse and flip tests pass). No explicit test asserts the shell keeps `sticky` after expand toggle. Browser scroll verification at breakpoints was not run in this pass.
