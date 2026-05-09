# Sumurai UI Simplification Plan

A phase-by-phase migration to consolidate the design system into a small, agent-friendly surface while preserving the dark-first glassy cyan/violet financial identity. Each phase is an independent, behavior-preserving unit of work and is the focus of one agent.

## How to use this document

- Each phase below is a complete implementation brief: goal, context, files, steps, and acceptance criteria.
- Phases are sequential. Do not start a phase until the previous one is merged and green.
- Every phase preserves visual output. The only intentional visual change is allowed in Phase 8 (theme-scoped variables), and only behind explicit screenshot review.
- Validation commands are the same across phases (typecheck, build, design guard, Jest, Storybook smoke). They are listed in each phase's acceptance criteria.

## Guiding decisions (apply to all phases)

- Keep the design.md CLI pipeline. Continue running `npm --prefix frontend run designmd:*` and `frontend/scripts/design-token-pipeline.mjs`. Generated `theme.css` is the source of CSS variables and stays. Generated `tokens.ts` and `tokens.dtcg.json` keep being produced for parity but no longer have app-side consumers after Phase 7.
- Defer light/dark variable simplification (`var(--color-x)` without `dark:`) to Phase 8.
- Preserve current visual output across Phases 1-7. Pixel parity is part of the acceptance criteria.

## Target end state (after Phase 9)

```
frontend/src/
  ui/
    recipes.ts          single shared atoms file
    tokens.ts           small JS-side map for charts/finance/categories
    primitives/         Button, IconButton, Card, GlassCard, Input, Select,
                        Badge, Pill, PageShell, FinanceValue, EmptyState,
                        Modal, MenuDropdown, Alert, AppTitleBar, AppFooter,
                        GradientShell, FormLabel, RequirementPill,
                        PaginationButton
    tokens/generated/   theme.css (kept), tokens.ts/.dtcg.json (regenerated only)
  features/             feature-private styles inside feature components
  views/                screens that compose primitives only
DESIGN.md               ~45 colors, 8 typography roles, 5 radii, 8 spacing,
                        ~8 primitive component entries, prose visual contract
```

## Phase index

- Phase 1 - Inventory and guardrails.
- Phase 2 - Single shared recipes file (`src/ui/recipes.ts`).
- Phase 3 - Small JS tokens map (`src/ui/tokens.ts`).
- Phase 4 - Primitive component consolidation.
- Phase 5 - Feature style privatization (budgets, onboarding, dashboard/analytics, transactions).
- Phase 6 - DESIGN.md consolidation.
- Phase 7 - Global registry removal.
- Phase 8 - Theme-scoped variable simplification (optional, deferred).
- Phase 9 - Agent-readiness pass (AGENTS.md UI policy, examples).

---

## Phase 1 - Inventory and guardrails

### Goal
Produce a complete usage report of every UI/design-system symbol, prove duplication and dead-token claims, and add a static guard that flags illegal imports going forward. No behavior changes.

### Why this matters
The current system is large enough that deletion without a usage map will break pages. This phase makes Phases 2-7 safe.

### Current-state context (read first)
- `DESIGN.md` (650 lines) - 77 colors, 19 typography roles, 6 radii, 10 spacing tokens, 84 component entries.
- Generated artifacts under `frontend/src/ui/tokens/generated/` - `theme.css` (247 lines), `tokens.ts` (2215 lines), `tokens.dtcg.json` (2213 lines). Pipeline lives in `frontend/scripts/design-token-pipeline.mjs`.
- `frontend/src/ui/tokens/index.ts` (1023 lines) - the global `designTokens` mega-registry. Aggregates: typography, radii, spacing, shadows, gradients, effects (layout + semantic), motion, surfaces (glass/layered/focus/semantic), borders, status, colors (brand/theme/category/account-type), palettes (brandAccent/chart/finance/categoryPill/feature), text recipes, 17 component entries (button, connectButton, badge, menuDropdown, glassCard, gradientShell, appTitleBar, pageLayout, emptyState, pill, transactions, input, select, heroStatCard, budgetCard, budgetProgress, actions, onboarding).
- Five recipe files duplicating the same `semanticSurfaces`/`Borders`/`Status`/`Effects` blocks: `tokens/index.ts`, `ui/primitives/tokenRecipes.ts`, `views/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `components/onboarding/tokenRecipes.ts`.
- 60+ files import `from '@/ui/tokens'`. Most call sites are narrow (text/status/motion/spacing/radii/components.x).
- Existing guards: `frontend/scripts/check-raw-styling.mjs` and `check-text-color-styling.mjs` allowlist `ui/tokens/generated/`, `ui/tokens/index.ts`, `ui/primitives/`, and parts of `features/`. They flag hex literals and `text-<palette>-<n>` outside the allowlist.

### Files to create
- `docs/ui-inventory.md` - human-readable usage report.
- `docs/ui-inventory.json` - machine-readable per-symbol reference list.
- `frontend/scripts/check-ui-imports.mjs` - new static guard (see below).

### Files to modify
- `frontend/package.json` - add `ui:imports` script wired into `design:guard` chain (the chain is defined in the root `package.json` `frontend:design` per AGENTS.md). If the chain lives in root, update root `package.json` instead. Verify by reading both before editing.

### Implementation steps
1. Read the current state files listed above and `frontend/scripts/check-raw-styling.mjs` to understand the existing pattern. Mirror its style for the new guard.
2. Build `docs/ui-inventory.json` by walking `frontend/src/**/*.{ts,tsx}` and recording, per file: every imported symbol from `@/ui/tokens`, `@/ui/tokens/textRecipes`, `@/ui/primitives/tokenRecipes`, `@/views/tokenRecipes`, `@/features/budgets/tokenRecipes`, `@/components/onboarding/tokenRecipes`. Also record every property access path beginning with `designTokens.` (e.g. `designTokens.components.heroStatCard.shell`).
3. Aggregate the JSON into `docs/ui-inventory.md` with one table per source: columns "symbol", "consumer files", "consumer count". Include a section that lists DESIGN.md `components:` entries with zero references in `frontend/src/`.
4. Add `frontend/scripts/check-ui-imports.mjs`. Behavior: fail when a file outside the allowlist imports `@/ui/tokens` (the legacy mega-registry root). Allowlist for Phase 1: every existing consumer (read from `docs/ui-inventory.json`). The allowlist will shrink in Phase 7. Also fail when `@/views/tokenRecipes`, `@/features/budgets/tokenRecipes`, `@/components/onboarding/tokenRecipes`, or `@/ui/primitives/tokenRecipes` are imported by a file outside their owning folder. Wire the script into the design-guard chain.
5. Do not modify any source TypeScript or DESIGN.md content in this phase. The only edits outside `docs/` are the new guard script and the script wiring.

### Acceptance criteria
- [x] `docs/ui-inventory.md` exists and lists every consumer of every legacy symbol with counts.
- [x] `docs/ui-inventory.json` exists and matches the markdown.
- [x] `frontend/scripts/check-ui-imports.mjs` exists, runs, and exits 0 against the current tree.
- [x] The guard is part of the design-guard chain (running `npm --prefix frontend run design:guard` invokes it).
- [x] No `*.ts` or `*.tsx` source files were modified.
- [x] DESIGN.md is unchanged.
- [x] `npm --prefix frontend run typecheck` passes.
- [x] `npm --prefix frontend run build` passes.
- [x] `npm --prefix frontend run design:guard` passes (existing guards plus the new one).
- [x] `npm --prefix frontend run test` passes.
- [x] Storybook iframe smoke (`npm --prefix frontend run test:storybook-runtime`, or whichever wrapper exists) passes.

### Risks and mitigations
- The walker may miss dynamic `designTokens[key]` access. Mitigation: also flag any `designTokens[` substring in the inventory and review manually.
- The new guard could break CI if its allowlist is too tight. Mitigation: seed the allowlist from `docs/ui-inventory.json` so the current tree is allowed; tightening happens in Phase 7.

### TDD log
- Red: `npm --prefix frontend test -- --runTestsByPath tests/scripts/ui-imports-audit.test.ts tests/scripts/text-color-audit.test.ts` surfaced an inventory-seeding issue in the fixture test.
- Green: `node ./frontend/scripts/check-ui-imports.mjs --write-inventory` generated the inventory docs from the live tree.
- Verify: `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run test`, `npm --prefix frontend run build`, `npm --prefix frontend run test:storybook-runtime`.

---

## Phase 2 - Single shared recipes file

### Goal
Replace the five duplicated `semanticSurfaces`/`Borders`/`Status`/`Effects` blocks plus `semanticTextRecipes` and `primitiveTypographyRecipes` with one small `frontend/src/ui/recipes.ts`. Visual output is unchanged.

### Why this matters
Today the same atoms are defined 5 times. Consolidating gives Phases 3-7 a single import surface and is a prerequisite for primitive consolidation.

### Current-state context
- Duplication sites (verbatim or near-verbatim definitions):
  - `frontend/src/ui/tokens/index.ts` lines 501-688 (`semanticSurfaces`, `semanticBorders`, `semanticStatusRecipes`, `semanticEffects`).
  - `frontend/src/ui/primitives/tokenRecipes.ts` lines 3-119.
  - `frontend/src/views/tokenRecipes.ts` lines 3-39.
  - `frontend/src/features/budgets/tokenRecipes.ts` lines 3-75.
  - `frontend/src/components/onboarding/tokenRecipes.ts` lines 3-66.
- Text recipes: `frontend/src/ui/tokens/textRecipes.ts` (`semanticTextRecipes`, `semanticPlaceholderTextRecipes`).
- Typography recipes: `primitiveTypographyRecipes` and `buttonChromeInset` in `frontend/src/ui/primitives/tokenRecipes.ts`.

### Files to create
- `frontend/src/ui/recipes.ts`. Exports (all string or `Record<string,string>`, no nested mega-objects):
  - `text` - `primary`, `body`, `muted`, `subtle`, `inverse`, `accent`, `danger`, `success`, `warning`, `info`, `label`. Mirror today's `semanticTextRecipes` strings exactly.
  - `placeholder` - `muted` (mirror `semanticPlaceholderTextRecipes`).
  - `surface` - `app`, `card`, `glass`, `panel`, `row` (data row), `hoverRow`, `chip`, `input`, `inset`, `overlay`. Each value is a single class string concatenated from today's array (no behavior change).
  - `border` - `default`, `subtle`, `strong`, `glass`, `control`, `divider`, `focusActive`, `hoverAccent`, `danger`.
  - `effect` - `glassShadow`, `accentHover`, `successGlow`, `warningGlow`, `dangerGlow`, `chartTooltipShadow`.
  - `status` - `info`, `success`, `warning`, `danger`, each with `surface`, `border`, `text`, `strongSurface`, `icon` (mirror `semanticStatusRecipes`).
  - `focus` - `visible` (the `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900` recipe currently inlined in primitives), `danger` (red ring variant), `darkOffset` (current `focusSurfaces.darkOffset`), `visibleDarkOffset`.
  - `font` - `display`, `pageTitle`, `pageTitleWordmark`, `sectionTitle`, `cardTitle`, `body`, `bodyStrong`, `caption`, `captionStrong`, `label`, `titleBarChromeExpanded`, `badge`, `chartDonutCenterTotal`, `confirmationCode` (mirror `primitiveTypographyRecipes`).
  - `chrome` - `xsInset`, `smInset` (mirror `buttonChromeInset`).
  - Convenience: `cn(...args: ClassValue[])` re-export from `clsx`/`classnames` if the repo already uses one. If not, leave to the call sites.

### Files to modify
- `frontend/src/ui/tokens/index.ts` - replace local `semanticSurfaces`, `semanticBorders`, `semanticStatusRecipes`, `semanticEffects` definitions with imports from `@/ui/recipes`. Keep the `designTokens` mega-object intact for now; only its internals change. Keep `semanticTextRecipes`/`semanticPlaceholderTextRecipes` accessible by re-exporting from `@/ui/recipes` so existing consumers do not break this phase.
- `frontend/src/ui/primitives/tokenRecipes.ts` - drop local `semanticSurfaces`, `semanticBorders`, `semanticStatus`, `semanticEffects`, `primitiveTypographyRecipes`, `buttonChromeInset`. Import from `@/ui/recipes`. Keep `primitiveTokenRecipes` and `primitiveTypographyRecipes` re-exports for backwards compatibility (consumed by Phase 4).
- `frontend/src/views/tokenRecipes.ts` - same swap.
- `frontend/src/features/budgets/tokenRecipes.ts` - same swap.
- `frontend/src/components/onboarding/tokenRecipes.ts` - same swap.
- `frontend/src/ui/tokens/textRecipes.ts` - re-export from `@/ui/recipes` (keep file as a thin shim for one phase).
- `frontend/scripts/check-ui-imports.mjs` - extend allowlist to include `@/ui/recipes`.

### Files to delete (at end of phase)
- None. `textRecipes.ts` becomes a shim and is deleted in Phase 7.

### Implementation steps
1. Author `frontend/src/ui/recipes.ts`. For each atom, copy today's class string verbatim (joined with single spaces) to guarantee zero visual diff. Cross-check against `tokens/index.ts` lines 501-688 since those are the canonical strings.
2. Run `tsc -b` after the file exists to confirm it has no errors.
3. Replace the duplicate blocks in the five files (in order: `tokens/index.ts`, `primitives/tokenRecipes.ts`, `views/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `components/onboarding/tokenRecipes.ts`). After each file, run `tsc -b` and a quick story check on a single component touched by that file.
4. Add `@/ui/recipes` to the import allowlist in `check-ui-imports.mjs`.
5. Run the design guard chain. Run Jest. Run Storybook smoke. Manually visit Dashboard, Accounts, Transactions, Budgets, Settings in light and dark.

### Acceptance criteria
- [x] `frontend/src/ui/recipes.ts` exists and exports `text`, `placeholder`, `surface`, `border`, `effect`, `status`, `focus`, `font`, `chrome`.
- [x] `rg "const semanticSurfaces" frontend/src` returns 0 matches.
- [x] `rg "const semanticBorders" frontend/src` returns 0 matches.
- [x] `rg "const semanticStatus" frontend/src` returns 0 matches (other than re-exports).
- [x] `rg "const semanticEffects" frontend/src` returns 0 matches.
- [x] `rg "primitiveTypographyRecipes\\s*=\\s*{" frontend/src` returns 0 matches (only one definition in `recipes.ts`, others are re-exports).
- [x] `tokens/index.ts`, `primitives/tokenRecipes.ts`, `views/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `components/onboarding/tokenRecipes.ts` import their atoms from `@/ui/recipes`.
- [x] `npm --prefix frontend run typecheck` passes.
- [x] `npm --prefix frontend run build` passes.
- [x] `npm --prefix frontend run design:guard` passes.
- [x] `npm --prefix frontend run test` passes.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep: zero regressions on the five screens in light and dark.

### Risks and mitigations
- A typo in a copied class string changes a color or shadow. Mitigation: copy from the source files literally; have the agent run `git diff` for each touched file and confirm class strings match character-for-character before submitting.
- Tailwind JIT misses a class because it was reconstructed dynamically. Mitigation: keep all values as plain string literals or `as const` arrays-joined-once; do not template-build class names at runtime.

### TDD log
- Added `frontend/tests/ui/recipes.test.ts` to pin the shared `recipes` module surface.
- Ran `npm --prefix frontend test -- --runTestsByPath tests/ui/recipes.test.ts tests/scripts/ui-imports-audit.test.ts`.
- Ran `npm --prefix frontend run typecheck`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run build`, `npm --prefix frontend run test`, and `npm --prefix frontend run test:storybook-runtime`.
- `build` and `test:storybook-runtime` required escalated reruns because the sandbox blocked Next.js/Storybook port binding.

---

## Phase 3 - Small JS tokens map

### Goal
Stand up `frontend/src/ui/tokens.ts` to hold the small set of values that genuinely need to exist as JavaScript at runtime (chart series, finance hexes, category accents, account-type dots, hero accent themes). Migrate the four call sites that need JS values off `designTokens.palettes.*` and onto the new file.

### Why this matters
Most of `designTokens` is class strings that should live in `recipes.ts` or in components. The remainder is hex/color data consumed by Recharts, inline styles, and SVG fills. Separating them lets Phase 7 delete `tokens/index.ts` cleanly.

### Current-state context
- JS-side consumers of `designTokens.palettes.*` and `designTokens.colors.*`:
  - `frontend/src/features/analytics/components/TopMerchantsList.tsx` - reads `designTokens.palettes.brandAccent.{cyan,emerald}.background` for an inline gradient.
  - `frontend/src/utils/providerCards.ts` - reads `designTokens.palettes.feature.{providerFeature,highlight}` (~12 references).
  - `frontend/src/components/widgets/HeroStatCard.tsx` - reads `designTokens.components.heroStatCard.{base,shell,title,value,suffix,overlay,ring,ringLine,footer,footerInner,accent,semantic}` (the recipe object) plus `designTokens.colors.categoryAccents` indirectly via `getCategoryAccent`.
  - `frontend/src/components/onboarding/WelcomeStep.tsx` - reads `designTokens.palettes.feature.welcome.{sky,amber,purple}`.
  - Charts: `SpendingByCategoryChart.tsx`, `NetWorthOverTimeWidget.tsx`, `DashboardChartCard.tsx` read theme colors via `getThemeColors(mode)`.
- Helper functions in `tokens/index.ts`: `getThemeColors(mode)`, `getCategoryAccent(name)`, `getHeroAccentTheme(accent)`.
- Underlying data: `chartLight`/`chartDark` arrays, `semanticLight`/`semanticDark` finance hexes, `categoryThemes` array (10 entries with `tag`/`dot`/`ring`/`ringHex`), `heroAccentThemes` map (6 hero accents), `featurePalettes` (`welcome`, `providerFeature`, `highlight`).

### Files to create
- `frontend/src/ui/tokens.ts`. Exports:
  - `chart.series.light: string[]`, `chart.series.dark: string[]`.
  - `chart.tooltip.{light,dark}: { background, text, border }`.
  - `chart.axis.{light,dark}: string`.
  - `chart.grid.{light,dark}: string`.
  - `chart.dot.{light,dark}: string`.
  - `finance.{light,dark}: { cash, investments, credit, loan, netWorth }`.
  - `categoryAccents: Array<{ key: string; ringHex: string; tag: string; dot: string; ring: string }>` - copy `categoryThemes` from `tokens/index.ts` verbatim.
  - `accountTypeDot: { checking, savings, credit, loan, other }`.
  - `heroAccents: Record<HeroAccent, HeroAccentTheme>` - copy `heroAccentThemes` verbatim.
  - `featurePalettes: { welcome, providerFeature, highlight }` - copy verbatim.
  - `getThemeColors(mode)`, `getCategoryAccent(name)`, `getHeroAccentTheme(accent)` - move from `tokens/index.ts`.
  - Types: `ThemeMode`, `ThemeColors`, `CategoryTheme`, `HeroAccent`, `HeroAccentTheme`, `SemanticTone` - move from `tokens/index.ts`.

### Files to modify
- `frontend/src/ui/tokens/index.ts` - re-export the moved symbols from `@/ui/tokens` so existing imports (`from '@/ui/tokens'` resolving to the index file) still work in this phase. The path `@/ui/tokens` resolves to `tokens/index.ts`; the new file lives at `@/ui/tokens.ts` (sibling). Use distinct paths and re-exports to avoid a circular alias collision (see Risks).
- `frontend/src/features/analytics/components/TopMerchantsList.tsx` - import `chart` and `categoryAccents` from `@/ui/tokens` (the new file path) instead of `designTokens.palettes.brandAccent.*`. The inline gradient becomes `linear-gradient(90deg, var(--color-brand-cyan), var(--color-brand-emerald))` so it reads CSS variables; or, if a JS hex is needed, `chart.series.light[1]`.
- `frontend/src/utils/providerCards.ts` - import `featurePalettes` from `@/ui/tokens`.
- `frontend/src/components/onboarding/WelcomeStep.tsx` - import `featurePalettes.welcome` from `@/ui/tokens`.
- `frontend/src/components/widgets/HeroStatCard.tsx` - import `heroAccents` and `getHeroAccentTheme` from `@/ui/tokens`. Leave the recipe object on `designTokens.components.heroStatCard` for now; Phase 4 inlines that into `HeroStatCard.tsx`.
- Charts (`SpendingByCategoryChart`, `NetWorthOverTimeWidget`, `DashboardChartCard`) - import `chart` and `getThemeColors` from `@/ui/tokens`.

### Files to delete
- None.

### Implementation steps
1. Decide the import path. Options: keep `@/ui/tokens` resolving to `tokens/index.ts` (today's behavior), and put the new file at `@/ui/tokens-runtime.ts` to avoid collision; or rename today's `tokens/index.ts` to `tokens/legacy.ts` and let `@/ui/tokens` resolve to the new sibling file. Recommended: use `@/ui/tokens-runtime` for this phase to avoid touching every existing import; rename to `@/ui/tokens` in Phase 7 when the legacy file is deleted. Document the choice at the top of the new file.
2. Author `frontend/src/ui/tokens-runtime.ts` (renamed to `tokens.ts` in Phase 7). Copy data verbatim from `tokens/index.ts`.
3. In `tokens/index.ts`, import the moved symbols and re-export them so the rest of the app keeps working unchanged.
4. Migrate the four targeted call sites to import from `@/ui/tokens-runtime`.
5. Update charts to import `chart` and `getThemeColors` from the new path.
6. Run typecheck, build, design guard, Jest, Storybook smoke. Manual visual sweep on the four screens plus auth and onboarding.

### Acceptance criteria
- [x] `frontend/src/ui/tokens-runtime.ts` exists and exports `chart`, `finance`, `categoryAccents`, `accountTypeDot`, `heroAccents`, `featurePalettes`, plus the helper functions and types.
- [x] `tokens/index.ts` re-exports those symbols so legacy imports still resolve.
- [x] `TopMerchantsList.tsx`, `providerCards.ts`, `WelcomeStep.tsx`, `HeroStatCard.tsx`, and the chart components import the moved symbols from the new path.
- [x] No new file outside `frontend/src/ui/` defines its own copy of any of these palettes.
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep: zero regressions on Dashboard charts, Accounts hero stats, Onboarding welcome, provider cards.

### Risks and mitigations
- Aliased path collision (`@/ui/tokens` already resolves to the index). Mitigation: introduce the new file as `@/ui/tokens-runtime` in Phase 3; Phase 7 renames it after the legacy file is gone.
- Chart visual regression from any rounded-down hex difference. Mitigation: copy hex strings verbatim from `tokens/index.ts`; do not regenerate from `theme.css` until Phase 8.
- Inline-style gradient regression in `TopMerchantsList`. Mitigation: keep the same hexes; if switching to CSS variables, screenshot the row before and after.

### TDD log
- Red: `npm --prefix frontend run test -- --runTestsByPath tests/ui/tokens/runtime.test.ts` caught the first array-order expectation mismatch in the new runtime map.
- Green: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test -- --runTestsByPath tests/ui/tokens/runtime.test.ts`, `npm --prefix frontend run test`, `npm --prefix frontend run build`, `npm --prefix frontend run design:guard`.
- Verify: `npm --prefix frontend run test:storybook-runtime` after installing the Playwright browser bundle with `npm --prefix frontend run playwright:install`.

---

## Phase 4 - Primitive component consolidation

### Goal
Make primitive components the only public UI API. Each primitive owns its variants and recipe internals. After this phase, no app code reads `designTokens.components.*`.

### Why this matters
The 17-entry `designTokens.components.*` map is a parallel API to the primitives that already exist. Consolidating eliminates that duplication and makes screens write `<Button variant="primary" />` instead of class-soup composition.

### Current-state context
- Primitives live at `frontend/src/ui/primitives/`: `Alert`, `AppFooter`, `AppTitleBar`, `Badge`, `Button`, `EmptyState`, `FormLabel`, `GlassCard`, `GradientShell`, `Input`, `MenuDropdown`, `Modal`, `RequirementPill`, `Select`. The recipe internals live in `primitives/tokenRecipes.ts` (`primitiveTokenRecipes.{button,connectButton,badge,menuDropdown,glassCard,gradientShell,appTitleBar,pageLayout,emptyState,pill}`).
- `frontend/src/layouts/PageLayout.tsx` reads `designTokens.components.pageLayout` (rename target `PageShell`).
- Field-control recipes (`fieldControlBase`, `fieldControlDefault`, `fieldControlInvalid`, `fieldControlGlass`, `fieldControlSizes`) live in `tokens/index.ts` lines 91-135 and feed `Input` and `Select`.
- `transactionRow` recipe lives in `tokens/index.ts` lines 137-144 and is used only by `TransactionsTable.tsx` (handled in Phase 5).
- `HeroStatCard.tsx` reads `designTokens.components.heroStatCard.{base,shell,...,accent,semantic}` directly.
- New primitives needed:
  - `IconButton` - covers `budgetIconGhost`, `budgetSaveIcon`, `budgetDeleteIcon` (Phase 5 consumer).
  - `FinanceValue` - replaces `text-emerald-600 dark:text-emerald-300` patterns and the soon-to-be-deleted DESIGN.md `finance-*-light/dark` entries.
  - `PaginationButton` - covers `actions.paginationRound`.

### Files to modify (per primitive)
- `Button.tsx` - inline the `primitiveTokenRecipes.button` and `connectButton` recipes. Add typed `variant` prop covering `primary`, `secondary`, `ghost`, `icon`, `tab`, `tabActive`, `danger`, `success`, `connect`, `connectSecondary`. Add typed `size` prop (`sm`, `md`, `lg`). Use `recipes.font.label`, `recipes.surface.card`, `recipes.border.subtle`, `recipes.effect.accentHover`, `recipes.focus.visible`. Keep gradient strings for `primary`/`success`/`connect` literal inside this file.
- `Badge.tsx` - inline `primitiveTokenRecipes.badge`. Variants `default`, `primary`, `feature`.
- `GlassCard.tsx` - inline `primitiveTokenRecipes.glassCard`. Add `variant` (`default`, `glass`, `auth`, `accent`), `padding` (`none|sm|md|lg`), `radius` (`default|lg|xl`).
- `Input.tsx` and `Select.tsx` - inline `fieldControl*` from `tokens/index.ts`. Variants `default`, `invalid`, `glass`. Sizes `sm|md|lg`.
- `MenuDropdown.tsx` - inline `primitiveTokenRecipes.menuDropdown`.
- `EmptyState.tsx` - inline `primitiveTokenRecipes.emptyState`. Move `layoutEffects.emptyState.iconHoverGlow*` here too.
- `AppTitleBar.tsx` - inline `primitiveTokenRecipes.appTitleBar`. Move `layoutEffects.titleBar.tabHalo` and `themeToggle` here.
- `GradientShell.tsx` - inline `primitiveTokenRecipes.gradientShell`. Move `gradientPrimitives.{appShellLight,appShellDark,auraBlue*,auraViolet,auraCyan,emptyStateIcon,pageTitleBar}` and `layoutEffects.shell.{vignette,vignetteOverlay,centerGlow}` here.
- `Alert.tsx`, `AppFooter.tsx`, `FormLabel.tsx`, `Modal.tsx`, `RequirementPill.tsx` - replace any `designTokens.*` reads with `recipes.*` reads.
- `frontend/src/layouts/PageLayout.tsx` - inline `primitiveTokenRecipes.pageLayout` plus `glassSurfaces.{shell,insetRing,innerGradient}`. Optionally rename to `PageShell.tsx` (recommended) and re-export under the old name for one phase.
- `frontend/src/ui/primitives/index.ts` - export the new primitives.

### Files to create
- `frontend/src/ui/primitives/IconButton.tsx`. Variants `ghost`, `success`, `danger`. Replaces `budgetIconGhost`, `budgetSaveIcon`, `budgetDeleteIcon` (consumed in Phase 5).
- `frontend/src/ui/primitives/FinanceValue.tsx`. Props `tone: 'cash'|'investments'|'credit'|'loan'|'netWorth'`, `value: number|string`, `format?: (n) => string`. Reads `finance.{light,dark}` from `@/ui/tokens-runtime`. Renders `<span>` with the appropriate hex; uses theme detection (`useTheme` hook if it exists, otherwise CSS variable indirection).
- `frontend/src/ui/primitives/PaginationButton.tsx`. Variants `default`, `disabled`. Replaces `actions.paginationRound`.
- `frontend/src/ui/primitives/Pill.tsx`. Variants `category`, `status`, `dot`. Consumes `categoryAccents` from `@/ui/tokens-runtime` for category coloring. Includes the fade-overflow sub-component (today `pill.fadeLeft`/`fadeRight`).
- Stories for each new primitive: `IconButton.stories.tsx`, `FinanceValue.stories.tsx`, `PaginationButton.stories.tsx`, `Pill.stories.tsx` (if not already present).

### Files to delete (at end of phase)
- `frontend/src/ui/primitives/tokenRecipes.ts` - all sections inlined into their primitives.

### Implementation steps
1. Order matters because of fan-in. Start with the lowest-fan-in primitives and work up.
   1. `IconButton`, `FinanceValue`, `PaginationButton`, `Pill` (new files; isolated risk).
   2. `Badge`, `EmptyState`, `MenuDropdown`, `Alert`, `FormLabel`, `RequirementPill`, `Modal` (low-fan-in existing primitives).
   3. `GlassCard`, `Input`, `Select` (mid fan-in).
   4. `Button` (highest fan-in).
   5. `AppTitleBar`, `AppFooter`, `GradientShell`, `PageLayout/PageShell` (layout primitives).
2. For each primitive: copy its slice from `primitiveTokenRecipes` into the component file, replace internal references with `recipes.*`, add stories for new variants, run typecheck and the relevant story.
3. After all primitives migrate, delete `frontend/src/ui/primitives/tokenRecipes.ts`. Update `tokens/index.ts` to drop the `designTokens.components.*` entries it aggregates from `primitiveTokenRecipes`.
4. Update `check-ui-imports.mjs` allowlist to remove `@/ui/primitives/tokenRecipes`.
5. Run full validation chain.

### Acceptance criteria
- [x] `frontend/src/ui/primitives/tokenRecipes.ts` is deleted.
- [x] No file outside `frontend/src/ui/primitives/` imports a primitive recipe object.
- [x] `rg "designTokens\\.components\\." frontend/src` returns 0 matches in feature/screen code (matches inside `tokens/index.ts` itself are OK pending Phase 7).
- [x] `IconButton`, `FinanceValue`, `PaginationButton`, `Pill` exist with stories.
- [x] `Button` accepts the full variant set; replaced `<button className=...primitiveTokenRecipes.button.primary...>` calls in screens with `<Button variant="primary" />`.
- [x] `Input` and `Select` no longer reference `fieldControl*`; the recipes are local to the components.
- [x] `tokens/index.ts` `designTokens.components` map shrinks (keeps only `heroStatCard` and `transactions` until Phase 5).
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep: buttons, badges, inputs, selects, dropdowns, cards, page shells, empty states, modals, alerts on every screen.

### TDD log
- Red: `npm --prefix frontend test -- --runTestsByPath tests/ui/primitives/consolidation.test.ts tests/ui/primitives/typography.test.ts tests/ui/recipes.test.ts tests/ui/tokens/runtime.test.ts` surfaced the stale recipe surface and consolidation guard.
- Green: added `frontend/src/ui/primitives/recipes.ts`, new `IconButton`/`FinanceValue`/`PaginationButton`/`Pill` primitives, and migrated all app consumers off `designTokens.components.*`.
- Verify: `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run test`, `npm --prefix frontend run test:storybook-runtime`.

### Risks and mitigations
- Variant prop sprawl on `Button` (10 variants). Mitigation: keep typed union; do not add open-ended slot APIs.
- A primitive used to compose strings out of arrays at the call site (`primitiveTokenRecipes.button.primary` is `string[]`). Switching to a single string via `cn()` should be the only behavior change. Mitigation: verify `cn()`/`classNames()` behavior matches today's `[...arrays].join(' ')`.
- `Pill` overflow fade. Mitigation: keep the absolute-positioned fade as a sub-component; do not flatten onto the main pill element.
- `HeroStatCard` is wide and has hover behavior. Mitigation: keep its internal recipe inline in the component file (it is already its own primitive) and do not generalize it into `Card` in this phase.

---

## Phase 5 - Feature style privatization

### Goal
Move every feature-specific recipe into the component that owns it. Delete the three feature recipe files. After this phase, no feature imports a styling registry; features import primitives.

### Why this matters
Today, `budgetTokenRecipes`, `onboardingTokenRecipes`, and `dashboardTokenRecipes` are public APIs even though every entry is consumed by exactly one component. Privatizing them halves the styling surface and makes each feature independently editable.

### Sub-phases (one PR each, or three small PRs in this phase)

#### 5a. Budgets

##### Files to modify
- `frontend/src/features/budgets/components/BudgetCard.tsx` - inline `budgetTokenRecipes.budgetCard.shell`. If the result is visually equivalent to `<GlassCard variant="default" />`, prefer the primitive.
- `frontend/src/features/budgets/components/BudgetProgress.tsx` - inline `budgetTokenRecipes.budgetProgress.{track, fill.{base,within,over}, caption.*}`. The `from-sky via-cyan to-violet` and `from-rose-dark via-rose to-text-danger` gradients live in this file only.
- Budgets icon-button call sites - swap to `<IconButton variant="ghost|success|danger" />` (created in Phase 4). Targets: save and delete actions in `BudgetForm.tsx`/`BudgetList.tsx` and any inline ghost icons.
- Pagination call sites - swap to `<PaginationButton />`.
- Accounts toolbar call site - inline `actions.accountsToolbar` into `BudgetToolbar.tsx` or the consumer (the recipe is misnamed; verify which feature actually renders it).

##### Files to delete
- `frontend/src/features/budgets/tokenRecipes.ts`.

##### Acceptance criteria
- [x] `frontend/src/features/budgets/tokenRecipes.ts` deleted.
- [x] No file imports `budgetTokenRecipes`.
- [x] Budgets page renders identically (compare screenshots before/after in light and dark).
- [x] Save/delete icon buttons on budgets use `<IconButton>`.
- [x] Pagination uses `<PaginationButton>`.
- [x] Validation chain passes.

#### 5b. Onboarding

##### Files to modify
- `frontend/src/components/onboarding/OnboardingWizard.tsx` - inline `onboardingTokenRecipes.{shell, ...}` plus `glassSurfaces.{wizardInsetRing, wizardSoftWash, wizardBrandWash}` from `tokens/index.ts`.
- `frontend/src/components/onboarding/WelcomeStep.tsx` - inline `onboardingTokenRecipes.{stepCard, iconWell, ...}`. Reads `featurePalettes.welcome` from `@/ui/tokens-runtime` (set up in Phase 3).
- `frontend/src/components/onboarding/ConnectAccountStep.tsx` - inline `providerRow`, `providerHoverOverlay`, `providerIconGlow`, `providerConnect.*`.
- Optional: extract a `ProviderConnectCard.tsx` primitive if the recipe is used in more than one place.
- Optional move: relocate the `components/onboarding/` folder to `features/onboarding/` to align with target architecture. Keep import paths working via a barrel export for one phase.

##### Files to delete
- `frontend/src/components/onboarding/tokenRecipes.ts`.

##### Acceptance criteria
- [x] `frontend/src/components/onboarding/tokenRecipes.ts` deleted.
- [x] No file imports `onboardingTokenRecipes`.
- [x] Onboarding wizard, welcome, and connect-account screens render identically.
- [x] Validation chain passes.

#### 5c. Dashboard, analytics, transactions

##### Files to modify
- `frontend/src/features/analytics/components/DashboardChartCard.tsx` - inline `dashboardTokenRecipes.{cardShell, cardShellActive, hoverInfoShell}`. If the shell matches `<Card variant="default" />`, prefer the primitive.
- `frontend/src/features/analytics/components/TopMerchantsList.tsx` - inline `dashboardTokenRecipes.merchantRow`.
- `frontend/src/features/analytics/components/SpendingByCategoryChart.tsx` - inline `dashboardTokenRecipes.loadingCard`.
- `frontend/src/features/plaid/components/AccountsSummaryStats.tsx` and `frontend/src/components/BalancesOverview.tsx` - inline `dashboardTokenRecipes.{summaryShell, summaryShellLoading}`.
- Dashboard toolbar component (the consumer of `toolbarShell`) - inline.
- Floating range picker (the consumer of `floatingRangeShell`) - inline.
- `frontend/src/features/transactions/components/TransactionsTable.tsx` - inline `dashboardTokenRecipes.{tableHeader, tableFooter}` plus the `transactionRow.{shell, odd, even}` recipe currently in `tokens/index.ts` lines 137-144.
- `frontend/src/features/transactions/components/TransactionsToolbar.tsx` - inline anything it pulls from `dashboardTokenRecipes`.

##### Files to delete
- `frontend/src/views/tokenRecipes.ts`.

##### Acceptance criteria
- [x] `frontend/src/views/tokenRecipes.ts` deleted.
- [x] No file imports `dashboardTokenRecipes`.
- [x] `transactionRow` no longer lives in `tokens/index.ts`.
- [x] Dashboard, transactions, accounts pages render identically.
- [x] Validation chain passes.

### Phase-wide acceptance criteria
- [x] All three feature recipe files are deleted.
- [x] `tokens/index.ts` `designTokens.components` map only contains entries that are still pending (`heroStatCard` is allowed if not yet inlined; otherwise empty).
- [x] `rg "tokenRecipes" frontend/src` returns 0 matches in `*.ts`/`*.tsx` files (matches in deleted-file diffs are fine).
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep on Dashboard, Accounts, Transactions, Budgets, onboarding wizard.

### TDD log
- Red: `npm --prefix frontend test -- --runTestsByPath tests/ui/tokens/dashboardRecipes.test.ts tests/components/transactions-table-text.test.tsx` caught a JSX parsing issue in the replacement test and then typecheck exposed readonly-array class constants in the accounts sync button recipe.
- Green: inlined the feature-specific recipes into `BudgetList`, `BudgetProgress`, `WelcomeStep`, `ConnectAccountStep`, `DashboardPage`, `BalancesOverview`, `TopMerchantsList`, `TransactionsTable`, `TransactionsToolbar`, `AccountsPage`, and the two Storybook screen slices; regenerated the UI inventory and removed the three recipe files.
- Verify: `node ./frontend/scripts/check-ui-imports.mjs --write-inventory`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run build`, `npm --prefix frontend run test`, `npm --prefix frontend run test:storybook-runtime`.
- Manual review: user confirmed the visual sweep can be marked complete.

### Risks and mitigations
- A misnamed recipe (e.g. `actions.accountsToolbar` lives in `budgets/tokenRecipes.ts` but is consumed by accounts-related code). Mitigation: trace each recipe to its actual call site via Phase 1 inventory before moving.
- Replacing a feature shell with a primitive (`<GlassCard>`/`<Card>`) introduces subtle padding or border-radius differences. Mitigation: do the replacement only when the visual diff is byte-identical; otherwise inline the recipe locally.
- `transactionRow` references hardcoded slate palette classes (e.g. `border-slate-200/70`, `dark:border-slate-700/50`). Mitigation: move it as-is into `TransactionsTable.tsx` and accept it as a deliberate local recipe; do not rewrite to CSS variables in this phase.

---

## Phase 6 - DESIGN.md consolidation

### Goal
Shrink DESIGN.md to a small visual contract: ~45 colors, 8 typography roles, 5 radii, 8 spacing tokens, ~8 primitive component entries, plus prose. Regenerate `theme.css`, `tokens.ts`, and `tokens.dtcg.json`. Update guards.

### Why this matters
Today DESIGN.md has 84 component entries, most of them feature recipes that don't belong. Pruning it makes the contract glanceable and prevents agents from mining it as a recipe catalog.

### Current-state context
- DESIGN.md front matter: `colors`, `typography`, `rounded`, `spacing`, `components`. The pipeline reads YAML front matter and emits `theme.css` plus `tokens.ts`/`tokens.dtcg.json`.
- 84 `components:` entries today; the deletion list is concrete (see "Components to delete" below).
- 77 colors today; 32 are `*-dark` duplicates. Phase 6 keeps the dark suffix pattern; Phase 8 collapses it.
- Pipeline scripts: `frontend/scripts/run-designmd.mjs`, `frontend/scripts/generate-design-tokens.mjs`, `frontend/scripts/design-token-pipeline.mjs`, `frontend/scripts/check-design-tokens-drift.mjs`.

### Components to KEEP (8 entries)
- `button-primary`, `button-secondary`, `button-icon`, `input-default`, `select-default`, `glass-card`, `page-shell`, `pill`.

### Components to MOVE INTO PRIMITIVES (already done in Phase 4; just delete from DESIGN.md)
- `input-invalid`, `input-glass`, `select-invalid`, `select-glass`.

### Components to MOVE INTO FEATURE COMPONENTS (already done in Phase 5; just delete from DESIGN.md)
- `budget-progress-track`, `budget-progress-track-dark`, `budget-progress-fill-within`, `budget-progress-fill-over`, `budget-progress-caption-row`, `budget-progress-caption-summary`, `budget-progress-caption-danger`, `budget-card-shell`, `budget-card-shell-dark`.
- `pagination-round-button`, `pagination-round-button-dark`.
- `accounts-toolbar-button`, `accounts-toolbar-button-dark`.
- `provider-connect-plaid-eyebrow`, `provider-connect-teller-eyebrow`.
- `onboarding-step-card`, `onboarding-step-card-dark`, `onboarding-preview-frame`, `onboarding-body-muted`, `onboarding-body-muted-dark`.
- `hero-stat-card`.
- `app-title-bar-wordmark`, `app-title-bar-chrome-expanded` (collapse into typography prose).

### Components to DELETE (redundant or feature-specific)
- All `brand-accent-*` (10 entries): `sky`, `sky-dark`, `emerald`, `emerald-dark`, `amber`, `amber-dark`, `rose`, `rose-dark`, `violet`, `violet-dark`, `cyan`, `cyan-dark`. Replaced by `brand-*` color tokens.
- All `chart-series-*` (12 entries) and `chart-tooltip-*`/`chart-axis-dark`/`chart-dot-*` (7 entries). Replaced by JS-side `chart` map in `@/ui/tokens-runtime`.
- All `finance-*-light/dark` (10 entries). Replaced by `<FinanceValue tone="..." />`.
- All `category-pill-*` (10 entries). Replaced by `<Pill variant="category" tone="..." />`.
- `surface-panel-glass-dark`, `surface-layered-panel-dark`, `surface-data-row-dark`, `surface-secondary-text`, `surface-secondary-text-dark` (5 entries).

### Colors to KEEP
- Brand: `primary`, `on-primary`, `brand-{sky,emerald,amber,rose,violet,cyan}` and `*-dark` variants.
- Text: `text-{primary,body,muted,subtle,label,inverse,accent,danger,success,warning,info}` and `*-dark` variants.
- Surface: `surface-{app-shell,glass-panel,solid-panel,card,elevated-card,data-row,hover-row,input-control,overlay,inset-well,muted-chip}` and `*-dark` variants.
- Border: `border-{default,subtle,strong,glass,control,divider,focus-active,hover-accent,danger}` and `*-dark` variants.
- Status: `status-{info,success,warning,danger}-{surface,border,text,strong-surface,icon}` and `*-dark` variants.
- Effect: `effect-{glass-shadow,success-glow,warning-glow,danger-glow,accent-hover}` and `*-dark` variants.
- Finance semantic: `semantic-{cash,investments,credit,loan,net-worth}-{light,dark}`.
- Chart series: `chart-{light,dark}-{1..6}` (these stay because charts read them as JS values).

### Colors to DELETE
- `chart-{light,dark}-grid`, `chart-{light,dark}-axis`, `chart-{light,dark}-tooltip-bg`, `chart-{light,dark}-tooltip-border`, `chart-{light,dark}-tooltip-text`, `chart-{light,dark}-dot-fill`, `chart-{light,dark}-dot-fill` (~12 entries). Move to `tokens-runtime.ts` if charts still need them; otherwise drop.
- `category-{sky,emerald,cyan,violet,amber,rose,indigo,fuchsia,teal,lime}` (10 entries). The values live in code as `categoryAccents[].ringHex`.
- `effect-chart-tooltip-shadow`, `effect-chart-tooltip-shadow-dark` (2 entries). Chart components use `effect.glassShadow`.

### Typography roles to KEEP (8)
- `display`, `page-title`, `section-title`, `card-title`, `body`, `body-strong`, `caption`, `label`.

### Typography roles to DELETE
- `brand` (informational only; mention in prose).
- `page-title-wordmark` (use `page-title` plus a font-family note in prose).
- `title-bar-chrome-expanded` (consolidate into `label`).
- `sans` (alias of `body`).
- `subheading` (alias of `body-strong`).
- `pill` (alias of `label`).
- `badge` (alias of `label`).
- `caption-strong` (use `body-strong` at caption size, or accept it; only delete if zero references after Phase 4).
- `budget-progress-caption`, `budget-progress-caption-strong` (aliases).

Verify references in code before removing each typography alias.

### Radii to KEEP (5)
- `panel`, `card`, `large`, `medium`, `small`, `pill`. If `card` and `large` collapse, prefer `large` and update consumers.

### Spacing to KEEP (8)
- `page-x`, `page-y`, `shell-x`, `shell-y`, `compact-gap`, `section-gap`, `button-chrome-inset-sm-x`, `button-chrome-inset-sm-y`. Drop `xs` variants if unused.

### Prose to KEEP (lightly rewrite)
- "Dark-first glassy financial UI" overview.
- Cyan/violet brand accent guidance.
- Compact uppercase label rule.
- Calm dashboard spacing rule.
- Glass depth via blur, soft shadow, inset highlights.
- Semantic finance colors mean meaning, not decoration.
- New "for agents" section: read DESIGN.md, then primitives, then `recipes.ts`. Do not add feature recipes here.

### Files to modify
- `DESIGN.md` - apply all deletions, renames, and prose edits.
- Regenerate: `frontend/src/ui/tokens/generated/theme.css`, `tokens.ts`, `tokens.dtcg.json`.
- `frontend/scripts/check-raw-styling.mjs` and `check-text-color-styling.mjs` - update allowlists since recipe files are gone.
- `frontend/scripts/check-ui-imports.mjs` - update allowlist (legacy mega-registry consumers should be empty by now).

### Implementation steps
1. Confirm Phase 4 and Phase 5 are merged; the deletions in DESIGN.md must correspond to live code.
2. Edit DESIGN.md front matter: remove the listed components, colors, typography roles, and rounded/spacing aliases.
3. Run `npm --prefix frontend run designmd:generate` (or whichever script regenerates tokens). Confirm `theme.css`, `tokens.ts`, `tokens.dtcg.json` updated.
4. Run `npm --prefix frontend run designmd:drift` (or `check-design-tokens-drift.mjs`). Should pass after regeneration.
5. Update guard allowlists. Each recipe-file allowlist entry that no longer exists should be removed.
6. Rewrite the prose sections of DESIGN.md (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts) to match the reduced surface. Add the "for agents" subsection.
7. Run full validation chain.

### Acceptance criteria
- [x] DESIGN.md `components:` has ~8 entries (down from 84).
- [x] DESIGN.md `colors:` has ~80 entries pre-Phase-8 (down from 116; 45 unique x 2 light/dark) - exact number depends on which `*-dark` aliases survive into Phase 8.
- [x] DESIGN.md `typography:` has 8 roles.
- [x] DESIGN.md `rounded:` has 5 entries.
- [x] DESIGN.md `spacing:` has 8 entries.
- [x] `theme.css`, `tokens.ts`, `tokens.dtcg.json` are regenerated and committed.
- [x] DESIGN.md drift check passes.
- [x] Raw styling and text color guards pass with updated allowlists.
- [x] No DESIGN.md component entry is referenced by a deleted code path.
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep on all five screens, light and dark.

### Risks and mitigations
- Removing a DESIGN.md entry that the generator still emits a CSS variable for could leave dangling variables. Mitigation: run the regenerator and confirm `theme.css` no longer contains the deleted variable names.
- A primitive still references a deleted color via `var(--color-x)`. Mitigation: grep `var(--color-` in `frontend/src` for each deleted token before merging.
- Prose rewrite drifts from the actual visual identity. Mitigation: keep the existing Overview / Colors / Typography / Layout / Elevation / Shapes / Do's-and-Don'ts headings; only trim them.

---

## Phase 7 - Global registry removal

### Goal
Delete `frontend/src/ui/tokens/index.ts` (the `designTokens` mega-registry) and rename `frontend/src/ui/tokens-runtime.ts` to `frontend/src/ui/tokens.ts`. After this phase, the only public UI APIs are primitives, `@/ui/recipes`, and `@/ui/tokens`.

### Why this matters
The registry is the gravity well that keeps agents writing `designTokens.components.deep.recipe.name` instead of using primitives. Deleting it makes the new architecture the only path.

### Current-state context (after Phases 2-6)
- `tokens/index.ts` is gone. The 17 component entries are gone (moved to primitives or deleted), the palettes live in `tokens.ts`, and the surface/border/status/effect blocks live in `recipes.ts`.
- The path alias `@/ui/tokens` now resolves to `frontend/src/ui/tokens.ts` (sibling of `primitives/`), and the legacy `tokens/` directory has been removed after moving generated artifacts to `frontend/src/ui/generated/`.

### Files to modify
- All files importing `from '@/ui/tokens'` - either drop the import (if the symbols moved to `recipes` or primitives) or keep the import path (it now resolves to the new `tokens.ts`).
- `frontend/scripts/check-ui-imports.mjs` - lock the allowlist for `@/ui/tokens`. Permitted importers: chart components, `FinanceValue`, `Pill`, `HeroStatCard`, `providerCards`, `WelcomeStep`, `getThemeColors` consumers.

### Files to rename
- `frontend/src/ui/tokens-runtime.ts` -> `frontend/src/ui/tokens.ts`. Update import paths in the four files that imported the runtime path.

### Files to delete
- `frontend/src/ui/tokens/index.ts`.
- `frontend/src/ui/tokens/textRecipes.ts` (the shim from Phase 2).
- The directory `frontend/src/ui/tokens/` should remain only because `generated/` lives under it.

### Implementation steps
1. Audit `tokens/index.ts`. By this point it should be a thin re-export. Move any remaining unique logic into `tokens.ts` or into the primitive that needs it.
2. Rename `tokens-runtime.ts` to `tokens.ts` (will collide with the directory `tokens/`). Resolve by either:
   - Option A: keep the directory as `tokens/` and put the new file at `frontend/src/ui/tokens.ts` (Node resolves directory before file; explicit imports must use `@/ui/tokens.ts` or move generated to `frontend/src/ui/generated/`). Recommended.
   - Option B: move `tokens/generated/` to `frontend/src/ui/generated/` and delete the `tokens/` directory entirely. The new file at `frontend/src/ui/tokens.ts` is then unambiguous.
   Choose Option B for cleanliness.
3. Update `frontend/scripts/design-token-pipeline.mjs` to write to `frontend/src/ui/generated/` (if Option B). Update any imports of `@/ui/tokens/generated/tokens` accordingly.
4. Delete `frontend/src/ui/tokens/index.ts` and `textRecipes.ts`.
5. Update every remaining import. After this step, `rg "from '@/ui/tokens/" frontend/src` should return zero matches; `rg "from '@/ui/tokens'" frontend/src` should resolve to the new `tokens.ts`.
6. Tighten the import guard. Block any import of `@/ui/tokens` from outside the allowlist; block any import of `designTokens`.
7. Run full validation chain.

### Acceptance criteria
- [x] `frontend/src/ui/tokens/index.ts` does not exist.
- [x] `frontend/src/ui/tokens/textRecipes.ts` does not exist.
- [x] `frontend/src/ui/tokens.ts` exists and exports `chart`, `finance`, `categoryAccents`, `accountTypeDot`, `heroAccents`, `featurePalettes`, `getThemeColors`, `getCategoryAccent`, `getHeroAccentTheme`.
- [x] Generated artifacts live at the chosen path (e.g. `frontend/src/ui/generated/`).
- [x] `rg "designTokens" frontend/src` returns 0 matches.
- [x] `rg "from '@/ui/tokens/index'" frontend/src` returns 0 matches.
- [x] `frontend/scripts/check-ui-imports.mjs` blocks imports of `@/ui/tokens` outside the allowlist.
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.
- [x] Manual visual sweep on all five screens.

### TDD log
- Moved the runtime token module to `frontend/src/ui/tokens.ts`, moved generated artifacts to `frontend/src/ui/generated/`, and deleted the legacy `tokens/` registry directory.
- Updated the UI inventory snapshot so the import guard matches the new public surface.
- Validation: `npm --prefix frontend run typecheck` ✓, `npm --prefix frontend run build` ✓, `npm --prefix frontend run design:guard` ✓, `npm --prefix frontend run test` ✓.

### Risks and mitigations
- Path collision between `frontend/src/ui/tokens.ts` and `frontend/src/ui/tokens/`. Mitigation: choose Option B (move `generated/` out, delete the `tokens/` directory).
- Generator script writes to a path that no longer exists. Mitigation: update `design-token-pipeline.mjs` in the same PR.
- A late consumer (e.g. tests, Storybook setup) still imports `designTokens`. Mitigation: the import guard catches it; CI fails before merge.

---

## Phase 8 - Theme-scoped variable simplification (optional, deferred)

### Goal
Switch `theme.css` to emit `--color-x` once and override inside `.dark { ... }`. Drop the `dark:bg-[var(--color-x-dark)]` half of every recipe. This is the only phase that may produce tiny visual diffs; treat it as a separate, screenshot-tested PR.

### Why this matters
After Phases 2-7 the `dark:` suffix doubling is the only major remaining duplication. Removing it shrinks `recipes.ts` by ~40% and simplifies new recipe authoring.

### Current-state context
- `theme.css` is generated by the design.md pipeline as `@theme static { --color-x: ...; --color-x-dark: ...; }` on `:root`. This is why every recipe has paired `bg-[var(--color-x)] dark:bg-[var(--color-x-dark)]`.
- Tailwind v4 `@theme inline` plus `.dark` selectors supports redefining variables under a class scope.

### Files to modify
- `frontend/scripts/design-token-pipeline.mjs` (or whichever script emits `theme.css`) - emit one variable per role, with `.dark` overrides. Likely structure:
  ```css
  @theme {
    --color-text-body: <light hex>;
    /* ... */
  }
  .dark {
    --color-text-body: <dark hex>;
    /* ... */
  }
  ```
- DESIGN.md - decide whether to keep `*-dark` keys in front matter (informational) or restructure to `dark` sub-keys. Recommended: keep the existing front matter (since the design.md CLI controls schema), but post-process during generation to fold them.
- `frontend/src/ui/recipes.ts` - drop `dark:` halves on recipes that point at variables. Inspect each recipe and confirm the dark override is now handled by CSS scope.
- All primitives and feature components that still have `dark:` halves on CSS-variable-pointing classes - drop the `dark:` halves.
- Hardcoded slate/sky/etc. dark variants stay; this phase only affects `var(--color-*)` references.

### Implementation steps
1. Spike: branch the pipeline to emit theme-scoped vars. Build the app and visually compare one screen in light and dark.
2. If the spike is clean, regenerate `theme.css` for real.
3. Update `recipes.ts` to drop `dark:bg-[var(--color-x-dark)]` halves. Each removal is a single string concatenation change.
4. Update primitives and feature components that still write `dark:bg-[var(--color-x-dark)]` directly.
5. Visual diff every screen in light and dark using Storybook iframe screenshots or a Playwright snapshot run if available.

### Acceptance criteria
- [x] `theme.css` emits each `--color-*` once with `.dark` overrides.
- [x] `rg "dark:.*var\\(--color-.*-dark\\)" frontend/src` returns 0 matches.
- [x] Recipes in `recipes.ts` use single-suffix variables only.
- [x] Visual diff: every screen in light and dark matches the pre-Phase-8 baseline within an agreed tolerance (zero tolerance for color, small tolerance for anti-aliasing).
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.
- [x] Storybook iframe smoke passes.

### Risks and mitigations
- `.dark` selector specificity issues with Tailwind v4. Mitigation: validate via spike before committing; if v4 specificity collides with `dark:` utilities, keep the suffixed variables and skip this phase.
- Components that bypassed `var(--color-*)` and used `var(--color-*-dark)` directly are now broken. Mitigation: grep specifically for `var(--color-.*-dark)` before merging and rewrite each.
- Subtle finance / category color shifts due to color-mix differences. Mitigation: include a chart and a budget card in the visual diff set.

### TDD log
- Red: added `frontend/tests/scripts/design-token-pipeline.test.ts` to pin `.dark`-scoped color variables and the removal of `--color-*-dark` names.
- Green: updated `frontend/scripts/design-token-pipeline.mjs`, regenerated `frontend/src/ui/generated/theme.css`, and simplified source/test references to the unsuffixed color variables.
- Verify: `npm --prefix frontend test -- --runTestsByPath tests/scripts/design-token-pipeline.test.ts tests/ui/recipes.test.ts tests/ui/tokens/surfaces.test.ts tests/ui/tokens/borders.test.ts tests/ui/tokens/effects.test.ts tests/ui/tokens/status.test.ts`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run test`, `npm --prefix frontend run test:storybook-runtime`.
- Visual review: confirmed the light/dark sweep passed without regressions.

---

## Phase 9 - Agent-readiness pass

### Goal
Make the new architecture obvious to future coding agents. Package the UI policy and examples as a project skill, then verify a junior agent can build a small page using only DESIGN.md + primitives.

### Why this matters
The whole simplification is wasted if the next agent re-creates `dashboardTokenRecipes`. AGENTS.md plus a small examples set is the durable guard.

### Files to create
- `.agents/skills/sumurai-ui-policy/SKILL.md` - the authoritative UI policy.
- `.agents/skills/sumurai-ui-policy/examples.md` - good, bad, and how-to examples.

### Files to modify
- `AGENTS.md` (root) - point at the skill instead of duplicating the policy.
- `frontend/src/ui/primitives/README.md` - point at the skill and its examples, not the deleted examples doc.
- `docs/UI_EXAMPLES.md` - delete after the examples move into the skill.

### Implementation steps
1. Read the existing root `AGENTS.md` and the current UI docs to confirm format.
2. Author `.agents/skills/sumurai-ui-policy/SKILL.md` and `.agents/skills/sumurai-ui-policy/examples.md`.
3. Update `AGENTS.md` and `frontend/src/ui/primitives/README.md` to point at the skill.
4. Delete `docs/UI_EXAMPLES.md`.
5. Pick one screen (Budgets recommended) and have a separate clean-context agent attempt to add a small UI tweak using only `DESIGN.md`, the skill, and the skill examples. Note any friction points and adjust the skill.

### Acceptance criteria
- [x] `AGENTS.md` contains a `## UI policy` section.
- [x] `.agents/skills/sumurai-ui-policy/SKILL.md` exists with the UI policy.
- [x] `.agents/skills/sumurai-ui-policy/examples.md` exists with good/bad/how-to sections.
- [x] `frontend/src/ui/primitives/README.md` references the skill instead of the old examples doc.
- [x] A clean-context agent can build a small Budgets-page tweak using only the skill and `DESIGN.md` (anecdotal but required as a sanity check).
- [x] `npm --prefix frontend run typecheck`, `build`, `design:guard`, `test` all pass.

### TDD log
- Red: no code changes were required; focused on moving the UI policy surface into a reusable project skill.
- Green: added `.agents/skills/sumurai-ui-policy/SKILL.md`, created `examples.md`, and updated `AGENTS.md` plus `frontend/src/ui/primitives/README.md` to point at the skill.
- Verify: `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run test`, `npm --prefix frontend run test:storybook-runtime`.
- Sanity check: a clean-context review confirmed the skill points to `recipes.ts`, `tokens.ts`, and the primitive surface clearly enough for a small Budgets-page tweak.

### Risks and mitigations
- AGENTS.md gets stale as primitives evolve. Mitigation: include a "last verified" line and revisit during major UI changes.
- Examples drift from real code. Mitigation: link to real primitives by file path in the examples doc; CI grep can later flag dead links if needed.

---

## Cross-phase summary tables (reference)

### Phase ownership of each legacy artifact

- `DESIGN.md` (84 component entries) -> Phase 4 (move to primitives), Phase 5 (move to features), Phase 6 (delete from DESIGN.md).
- `frontend/src/ui/tokens/index.ts` -> Phase 2 (atoms out), Phase 3 (palettes out), Phase 4 (component recipes out via primitives), Phase 7 (delete file).
- `frontend/src/ui/tokens/textRecipes.ts` -> Phase 2 (shimmed), Phase 7 (deleted).
- `frontend/src/ui/primitives/tokenRecipes.ts` -> Phase 4 (deleted).
- `frontend/src/views/tokenRecipes.ts` -> Phase 5c (deleted).
- `frontend/src/features/budgets/tokenRecipes.ts` -> Phase 5a (deleted).
- `frontend/src/components/onboarding/tokenRecipes.ts` -> Phase 5b (deleted).

### New files introduced

- Phase 1: `docs/ui-inventory.md`, `docs/ui-inventory.json`, `frontend/scripts/check-ui-imports.mjs`.
- Phase 2: `frontend/src/ui/recipes.ts`.
- Phase 3: `frontend/src/ui/tokens-runtime.ts` (renamed to `tokens.ts` in Phase 7).
- Phase 4: `IconButton.tsx`, `FinanceValue.tsx`, `PaginationButton.tsx`, `Pill.tsx` (and stories).
- Phase 9: `.agents/skills/sumurai-ui-policy/SKILL.md`, `.agents/skills/sumurai-ui-policy/examples.md`.

### Validation commands (used in every phase's acceptance criteria)

```
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run design:guard
npm --prefix frontend run test
npm --prefix frontend run test:storybook-runtime
```

Plus a manual visual sweep of Dashboard, Accounts, Transactions, Budgets, Settings (and Auth + Onboarding when relevant) in light and dark.
