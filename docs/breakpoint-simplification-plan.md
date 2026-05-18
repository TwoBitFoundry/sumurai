# Breakpoint Simplification Plan

## Summary
Reduce the frontend to three responsive tiers:
- Mobile: base classes only
- Tablet: `md:` at `768px`
- Desktop: `lg:` at `1024px`

This migration must preserve `DESIGN.md` as the visual source of truth. The work is breakpoint cleanup, not a redesign. Shared primitives, recipes, and tokens remain the default mechanism for expressing layout and styling.

## Decisions
- Tailwind screen usage should converge on base, `md`, and `lg`.
- No new `sm:`, `xl:`, or `2xl:` Tailwind screen usage should be introduced.
- Existing Tailwind `sm:` screen usage must be reassigned to either base or `md`.
- Existing Tailwind `xl:` and `2xl:` screen usage must be collapsed into `lg` or removed.
- Non-screen API names that contain `sm` or `xl` are out of scope:
  - `Button size="sm"`
  - `Input inputSize="sm"`
  - `Badge size="sm"`
  - `GlassCard rounded="xl"`
  - `GlassCard padding="sm"`
  - recipe tokens such as `chrome.sm`

## Phase 1: Freeze The Responsive Contract
Goal: establish the target breakpoint policy without changing visual behavior yet.

### Work
- Read and follow:
  - `DESIGN.md`
  - `docs/design-md-standard.md`
  - `frontend/src/ui/primitives/README.md`
  - `frontend/src/ui/recipes.ts`
  - `frontend/src/ui/tokens.ts`
- Treat the final responsive contract as:
  - base = mobile
  - `md` = tablet
  - `lg` = desktop
- Audit all remaining `sm:`, `xl:`, and `2xl:` Tailwind screen usage in `frontend/src`.
- Confirm migration scope is limited to breakpoint behavior, not token, recipe, or visual-role redesign.

### Acceptance Criteria
- [x] The implementer can state the final responsive policy without ambiguity.
- [x] There is a written list of all remaining Tailwind screen prefixes to migrate.
- [x] The implementer has read the required design-system sources before making UI changes.
- [x] The migration scope is explicitly constrained to breakpoint behavior, not token or recipe redesign.

### TDD log
- Verified the responsive contract by reading `DESIGN.md`, `docs/design-md-standard.md`, and the frontend design-system references.
- Audited current `sm/xl/2xl` usage with `rg -n "\\b(sm|xl|2xl):" frontend/src`.

## Phase 2: Migrate Shared Layout Shells To Base / md / lg
Goal: move the app-wide layout primitives off `sm` first, because they control the feel of the entire product.

### Work
- Update shared shells and spacing primitives first:
  - `frontend/src/layouts/AppLayout.tsx`
  - `frontend/src/layouts/PageLayout.tsx`
  - `frontend/src/ui/primitives/GradientShell.tsx`
  - `frontend/src/components/Footer.tsx`
- Reassign `sm:` rules using these decisions:
  - shell padding increases move to `md`
  - tablet-style vertical spacing increases move to `md`
  - desktop shell expansions remain `lg`
  - mobile-friendly compact spacing stays at base
- Keep the current mobile room gains intact.
- Do not replace shared recipe-driven classes with raw one-off values unless an existing local exception already exists and is necessary to preserve behavior.

### Acceptance Criteria
- [x] Shared layout files use only base, `md`, and `lg` Tailwind screen prefixes.
- [x] Mobile still preserves the reclaimed content width from the recent layout work.
- [x] At `768px`, shells become noticeably more spacious.
- [x] At `1024px+`, desktop shell behavior remains intact.
- [x] No new raw styling is introduced that should have been expressed through existing primitives or recipes.

### TDD log
- Added boundary assertions for `AppLayout`, `PageLayout`, `Footer`, and `GradientShell` shell spacing.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/layouts/AppLayout.test.tsx tests/layouts/PageLayout.test.tsx tests/components/Footer.test.tsx tests/ui/primitives/GradientShell.test.tsx`.
- Verified the shared shell files no longer contain `sm/xl/2xl` screen prefixes with `rg -n "\\b(sm|xl|2xl):" frontend/src/layouts/AppLayout.tsx frontend/src/layouts/PageLayout.tsx frontend/src/components/Footer.tsx frontend/src/ui/primitives/GradientShell.tsx`.

## Phase 3: Migrate Shared Components And Primitives
Goal: remove breakpoint ambiguity from reusable UI components before touching page-specific composition.

### Work
- Update reusable components that still contain `sm:` screen rules:
  - `frontend/src/ui/primitives/EmptyState.tsx`
  - `frontend/src/features/analytics/components/DashboardChartCard.tsx`
  - `frontend/src/features/transactions/components/TransactionsFilters.tsx`
  - `frontend/src/features/plaid/components/AccountsSummaryStats.tsx`
  - `frontend/src/components/BalancesOverview.tsx`
- Use this decision rule consistently:
  - if the breakpoint changes structure, alignment, width caps, or column count, move it to `md`
  - if it only prevents cramped presentation and still looks correct on phones, fold it into base
- If a repeated responsive pattern deserves a shared primitive or recipe adjustment, update the shared surface instead of duplicating page-level fixes.
- Do not modify `DESIGN.md` unless the migration exposes a real mismatch between documented design intent and the current design-system primitives.

### Acceptance Criteria
- [x] Reusable components no longer depend on `sm:` for layout behavior.
- [x] Component behavior is consistent across pages after migration.
- [x] No component API is changed unless required for layout correctness.
- [x] Shared responsive behavior is expressed through existing primitives or recipes where appropriate, not duplicated ad hoc.
- [x] `DESIGN.md` remains unchanged unless a genuine design-contract mismatch is identified.

### TDD log
- Added shared layout assertions for dashboard chart cards, empty states, transaction filters, account summary stats, budget summaries, provider selection, and budget lists.
- Extended `SpendingByCategoryChart` coverage to verify the chart wrapper now uses the `md` width cap.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/components/sharedResponsiveLayout.test.tsx tests/features/analytics/components/SpendingByCategoryChart.test.tsx`.
- Reconfirmed the shared component sources no longer contain `sm:` screen prefixes with `rg -n "\\b(sm|xl|2xl):" frontend/src/components frontend/src/features frontend/src/ui/primitives`.

## Phase 4: Migrate Page And Feature Layouts
Goal: convert page-specific composition to the new 3-tier model.

### Work
- Update view-level and feature-level composition files:
  - `frontend/src/views/DashboardPage.tsx`
  - `frontend/src/views/TransactionsPage.tsx`
  - `frontend/src/views/BudgetsPage.tsx`
  - `frontend/src/views/SettingsPage.tsx`
  - `frontend/src/Auth.tsx`
- Apply these explicit conversions:
  - `sm:grid-cols-2` -> `md:grid-cols-2`
  - `sm:grid-cols-3` -> `md:grid-cols-3`
  - `sm:flex-row` -> `md:flex-row`
  - `sm:items-center` -> `md:items-center`
  - `sm:justify-between` -> `md:justify-between`
  - `sm:w-64` -> `md:w-64`
  - `sm:text-right` -> `md:text-right`
  - `sm:w-auto` -> `md:w-auto`
  - `sm:justify-end` -> `md:justify-end`
- Keep base mobile layouts stacked and full-width unless there is a strong reason otherwise.
- Preserve existing recipe, token, and primitive composition.

### Acceptance Criteria
- [x] Dashboard, budgets, transactions, settings, and auth all use only base, `md`, and `lg` for screen breakpoints.
- [x] Mobile remains single-column or stacked where appropriate.
- [x] Tablet picks up the first structural reflow at `768px`.
- [x] No page regresses into horizontal overflow on mobile.
- [x] Page-level fixes do not introduce styling that conflicts with `DESIGN.md` patterns or existing primitives.

### TDD log
- Added page-level responsive assertions for dashboard, transactions, budgets, settings, and auth shells.
- Reran `Auth.tsx` through Jest by replacing the test-only `import.meta` logging guard with a `NODE_ENV` check.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/views/DashboardPage.test.tsx tests/views/SettingsPage.test.tsx tests/views/TransactionsPage.test.tsx tests/views/BudgetsPage.test.tsx tests/Auth.test.tsx`.
- Confirmed the page-level sources no longer contain `sm:` screen prefixes with `rg -n "\\b(sm|xl|2xl):" frontend/src/views/DashboardPage.tsx frontend/src/views/TransactionsPage.tsx frontend/src/views/BudgetsPage.tsx frontend/src/views/SettingsPage.tsx frontend/src/Auth.tsx`.

## Phase 5: Collapse xl And 2xl Into Desktop
Goal: eliminate wider-desktop-only branches and settle on one desktop composition.

### Work
- Remove `xl:` and `2xl:` Tailwind screen usage from:
  - `frontend/src/components/onboarding/ConnectAccountStep.tsx`
  - `frontend/src/components/onboarding/WelcomeStep.tsx`
  - `frontend/src/features/budgets/components/BudgetList.tsx`
- Use these explicit replacements:
  - onboarding `xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]` collapses to a single `lg` desktop split
  - choose one desktop ratio and keep it fixed at `lg+`
  - budget list remains `md:grid-cols-2` and becomes `lg:grid-cols-3`
  - remove `2xl:grid-cols-4` entirely
- Preserve the existing component visual language; only the breakpoint branching should change.

### Acceptance Criteria
- [x] No `xl:` or `2xl:` Tailwind screen prefixes remain in app code.
- [x] Desktop compositions still read well at large widths without extra breakpoint tiers.
- [x] Budget list does not exceed 3 columns.
- [x] Onboarding remains visually balanced on desktop with a single `lg` split rule.
- [x] Removing wider-desktop tiers does not require changes to tokens, recipes, or documented design roles.

### TDD log
- Added onboarding and budget list layout assertions for the desktop split and grid tiers.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/components/onboarding/ConnectAccountStep.test.tsx tests/components/onboarding/WelcomeStep.test.tsx tests/features/budgets/components/BudgetList.test.tsx`.
- Confirmed there are no remaining `xl:` or `2xl:` layout prefixes in `frontend/src/components/onboarding`, `frontend/src/features/budgets/components/BudgetList.tsx`, or `frontend/src/components/onboarding/OnboardingWizard.tsx`.

## Phase 6: Update Storybook Screen Slices
Goal: keep visual references aligned with the new responsive contract.

### Work
- Migrate remaining `sm:`, `xl:`, and `2xl:` screen usage in storybook slices:
  - `frontend/src/storybook/screenSlices/BudgetsScreenSlice.tsx`
  - `frontend/src/storybook/screenSlices/DashboardScreenSlice.tsx`
  - `frontend/src/storybook/screenSlices/SettingsScreenSlice.tsx`
  - `frontend/src/storybook/screenSlices/TransactionsScreenSlice.tsx`
- Match storybook slice behavior to production pages:
  - base = mobile composition
  - `md` = tablet composition
  - `lg` = desktop composition
- Keep storybook slices aligned to the same design-system primitives and recipes used by production code.

### Acceptance Criteria
- [x] Storybook reference slices reflect the same three-tier system as the app.
- [x] No storybook slice relies on `sm:`, `xl:`, or `2xl:` screen prefixes.
- [x] The visual reference environment no longer teaches a different breakpoint model than production.
- [x] Storybook examples still reinforce, rather than bypass, the `DESIGN.md` source of truth.

### TDD log
- Added a storybook slice responsive-contract test for the transactions, budgets, and settings reference screens.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/storybook/screenSlices/responsiveContract.test.tsx`.
- Reconfirmed `frontend/src/storybook/screenSlices` has no layout `sm`, `xl`, or `2xl` screen prefixes.

## Phase 7: Narrow Tailwind Screens And Verify
Goal: make the config enforce the new breakpoint policy once the code is clean.

### Work
- Update `frontend/tailwind.config.js` to define only:
  - `md: 768px`
  - `lg: 1024px`
- Confirm there are no remaining `sm:`, `xl:`, or `2xl:` Tailwind screen prefixes in `frontend/src`.
- Run:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run design:guard`
- Verify behavior in the in-app browser at representative widths:
  - narrow mobile
  - tablet around `768px`
  - desktop at `1024px+`

### Acceptance Criteria
- [ ] Tailwind config exposes only the intended tablet and desktop screens.
- [ ] `rg -n "\\b(sm|xl|2xl):" frontend/src` returns no Tailwind screen usages.
- [ ] Typecheck, frontend tests, and `design:guard` pass.
- [ ] Mobile, tablet, and desktop compositions all still render correctly in browser verification.
- [ ] The final result does not create drift between implementation and the `DESIGN.md`-driven design system.

## Risks
- Shared `sm:` usage currently carries real spacing and structure behavior, so collapsing it too mechanically could make large phones feel cramped.
- Removing `xl` and `2xl` may expose layouts that were relying on extra-wide desktop refinement rather than a solid `lg` composition.
- Storybook slices can drift from production if they are not migrated in the same pass.
- Design-system drift is possible if breakpoint cleanup is solved with local one-off classes instead of existing primitives and recipes.

## Next Actions
1. Implement Phase 2 first, because shared shell behavior determines whether the rest of the migration reads correctly.
2. Validate mobile, tablet, and desktop behavior after each phase rather than waiting for the end.
3. Run `design:guard` before narrowing Tailwind screens so any drift is caught before the final config change.
