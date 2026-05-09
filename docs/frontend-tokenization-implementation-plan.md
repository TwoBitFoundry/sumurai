# Frontend Tokenization Implementation Plan

## Summary

Complete the remaining design token gaps by making `DESIGN.md` the source of truth for surfaces, borders, status tones, and effect colors, then migrate frontend consumers away from raw Tailwind palette classes where semantic tokens should exist.

Keep the pipeline intact:

`DESIGN.md` -> `frontend/src/ui/tokens/generated/*` -> runtime recipes in `frontend/src/ui/tokens` and `frontend/src/ui/primitives` -> product components.

## Phase 1: Add Missing Source Tokens

Add semantic token roles to `DESIGN.md` for repeated visual primitives.

- Add light/dark surface color roles for app shell, glass panel, solid panel, card, elevated card, data row, hover row, input/control, overlay, inset well, and muted chip.
- Add light/dark border color roles for default, subtle, strong, glass, control, divider, focus/active, hover accent, and danger.
- Add status tone roles for info, success, warning, and danger, each with surface, border, text, strong surface, and icon/accent color where needed.
- Add effect color roles for common shadows/glows used by glass panels, success flash, error pulse, accent hover, and chart tooltip/drop shadow.
- Keep role names semantic and stable, not component-specific unless tied to a reusable component recipe.
- Do not remove existing brand, chart, finance, category, text, typography, radius, or spacing tokens.

Acceptance criteria:

- [x] `DESIGN.md` contains first-class `surface-*` roles.
- [x] `DESIGN.md` contains first-class `border-*` roles.
- [x] `DESIGN.md` contains reusable status tone roles for info, success, warning, and danger.
- [x] `DESIGN.md` contains reusable effect color roles for repeated shadow/glow/keyframe colors.
- [x] New tokens describe design intent, not raw Tailwind implementation details.
- [x] `npm --prefix frontend run design:lint` passes.

TDD log:

- Verified the design vocabulary in `DESIGN.md` and corrected the new color formats until `npm --prefix frontend run design:lint` passed with no errors.

## Phase 2: Regenerate And Expose Runtime Tokens

Regenerate token artifacts and expose the new roles through the TypeScript token API.

- Run `npm --prefix frontend run design:generate` so `tokens.dtcg.json`, `theme.css`, and `tokens.ts` match `DESIGN.md`.
- Add runtime class recipes in `frontend/src/ui/tokens/index.ts` and related token recipe files for `designTokens.surfaces.semantic`, `designTokens.borders`, `designTokens.status`, and `designTokens.effects`.
- Keep generated files generated; do not hand-edit generated token artifacts.
- Prefer small composable recipes over one-off page recipes.
- Keep existing exported token keys stable unless a replacement is added and all consumers are migrated in the same change.

Acceptance criteria:

- [x] Generated artifacts include the new `--color-surface-*` token fields.
- [x] Generated artifacts include the new `--color-border-*` token fields.
- [x] Generated artifacts include status and effect color fields.
- [x] `designTokens` exposes ergonomic runtime recipes for surfaces, borders, status tones, and effects.
- [x] Existing imports of `designTokens` continue to typecheck.
- [x] `npm --prefix frontend run design:drift` passes.

TDD log:

- Regenerated the design artifacts, added runtime semantic recipes in `frontend/src/ui/tokens/index.ts`, and verified the frontend typecheck plus design drift checks passed.

## Phase 3: Migrate Shared Recipes And Primitives

Replace raw border/background/status/effect classes inside token recipe files and primitives first, so product components can reuse the corrected layer.

Primary targets:

- `frontend/src/ui/primitives/tokenRecipes.ts`
- `frontend/src/ui/primitives/Alert.tsx`
- `frontend/src/ui/primitives/Modal.tsx`
- `frontend/src/ui/primitives/RequirementPill.tsx`
- `frontend/src/components/onboarding/tokenRecipes.ts`
- `frontend/src/features/budgets/tokenRecipes.ts`
- `frontend/src/app/globals.css`

Required migrations:

- Replace repeated `border-slate-*`, `border-white/*`, `border-red-*`, and accent border classes with `designTokens.borders` or `designTokens.status`.
- Replace repeated `bg-white/*`, `bg-slate-*`, `dark:bg-[#...]`, and status background classes with `designTokens.surfaces` or `designTokens.status`.
- Replace keyframe color literals in `globals.css` with generated CSS variables where CSS variable usage is supported.
- Keep layout, spacing, typography, behavior, and animation timing unchanged unless a token migration requires a direct equivalent.

Acceptance criteria:

- [ ] Shared recipes no longer define repeated raw surface or border colors when a semantic token exists.
- [ ] `Alert` variants use status tone recipes instead of hard-coded color classes.
- [ ] `Modal` overlay uses a surface/overlay token.
- [ ] Onboarding and budget token recipes use semantic surface, border, and status recipes.
- [ ] `globals.css` keyframe colors use generated CSS custom properties where practical.
- [ ] `npm --prefix frontend run typecheck` passes.

## Phase 4: Migrate Product Components

Move remaining product components from raw visual classes to semantic token recipes.

Primary targets:

- `DashboardPage.tsx` and matching Storybook screen slice
- `HeaderAccountFilter.tsx`
- `BalancesOverview.tsx`
- `Footer.tsx`
- `ProviderSelectionPanel.tsx`
- `AccountsSummaryStats.tsx`
- `TransactionsTable.tsx`
- `TransactionsToolbar.tsx`
- `TopMerchantsList.tsx`
- `BudgetSummaryCard.tsx`
- `AccountRow.tsx`
- `StatusPill.tsx`
- `OnboardingWizard.tsx`
- `ConnectAccountStep.tsx`
- `WelcomeStep.tsx`
- `BankCard.tsx`

Migration rules:

- Use existing component recipes where available before adding new ones.
- If multiple components repeat the same surface/border/status combination, add or extend a shared recipe rather than duplicating token arrays.
- Leave legitimate data visualization colors alone when they already use chart, category, finance, or account-type tokens.
- Do not migrate purely structural classes such as `border`, `border-b`, `bg-transparent`, layout utilities, radius utilities, or spacing utilities unless they carry a color decision.
- Keep Storybook screen slices visually aligned with their real view counterparts.

Acceptance criteria:

- [ ] Product components no longer contain repeated raw `bg-slate-*`, `bg-white/*`, `dark:bg-slate-*`, `border-slate-*`, `border-white/*`, or status color classes where semantic tokens exist.
- [ ] Dashboard view and Storybook dashboard slice use the same tokenized surface/border decisions.
- [ ] Provider, onboarding, transaction, budget, footer, and account filter UI states still expose the same visual states.
- [ ] `npm --prefix frontend run design:styling` passes.
- [ ] `npm --prefix frontend run lint` passes.

## Phase 5: Add Drift Coverage And Verify

Add tests and guardrails so the tokenization does not regress.

- Add focused token tests under `frontend/tests/ui/tokens/` for surfaces, borders, status tones, and effects.
- Extend raw styling checks only if the current scripts do not catch the newly migrated classes.
- Validate generated token names expected by runtime recipes.
- Run the full frontend validation path for token work.

Acceptance criteria:

- [ ] Token tests assert that surface roles exist and map to generated token fields.
- [ ] Token tests assert that border roles exist and map to generated token fields.
- [ ] Token tests assert that status tone recipes exist for info, success, warning, and danger.
- [ ] Token tests assert that key effect roles exist for glass, success, danger, and accent glow behavior.
- [ ] `npm --prefix frontend run design:guard` passes.
- [ ] `npm --prefix frontend run typecheck` passes.
- [ ] `npm --prefix frontend test -- --runTestsByPath frontend/tests/ui/tokens/surfaces.test.ts frontend/tests/ui/tokens/borders.test.ts frontend/tests/ui/tokens/status.test.ts` passes, using the actual test filenames created.
- [ ] `npm --prefix frontend run build` passes.

## Assumptions

- `DESIGN.md` remains the design source of truth.
- Generated files under `frontend/src/ui/tokens/generated/` are updated through `npm --prefix frontend run design:generate`.
- Tailwind consumes generated fields through `frontend/src/app/globals.css`, not through the stale `tailwind-bridge.js` reference.
- Raw palette classes are acceptable only for one-off visualization/data colors or structural Tailwind behavior where no semantic design decision is being encoded.
- No `.env` files are read or written.

## Risks

- Broad visual token migration can cause subtle UI regressions even when class names are equivalent.
- Generated artifact drift can hide real source-of-truth problems if generated files are hand-edited.
- Overly component-specific token names would make future design changes harder instead of easier.

## Next Actions

1. Start with the `DESIGN.md` token vocabulary.
2. Regenerate token artifacts.
3. Migrate shared recipes before product components.
4. Add token tests and run the validation commands listed above.
