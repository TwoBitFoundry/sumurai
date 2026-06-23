# Brand Color Replacement MPRD

## Summary

Replace the current cyan-violet-forward brand system with the new brand palette, keep the existing amber warning lane, rename the brand token vocabulary to match the new hues, regenerate the design token artifacts from `DESIGN.md`, and retheme the ambient shell background so light mode resolves through lighter brand colors and `brand-fog` while dark mode resolves through darker brand colors.

This work is not only a `DESIGN.md` swap. The repo currently exposes the old hue vocabulary through generated token outputs, runtime token helpers, accent registries, recipes, and the ambient gradient shell. The implementation must move those surfaces together so the design contract, generated artifacts, and frontend runtime stay aligned.

## Product decisions

- `brand-fog` is retained and is important to the light-mode ambient background. It is the off-white bridge that folds brighter brand color into the page field.
- `brand-fog` is also retained as `on-primary` and inverse/on-dark text support.
- `brand-fog` is not used as general light-mode page text on white surfaces.
- `credit` must stay in the red family.
- `loan` and warning semantics must stay in the amber family.
- The glass surfaces remain neutral. The ambient page background changes; the glass tint system does not.
- The frontend runtime API should be renamed to the new color vocabulary rather than carrying compatibility aliases.
- The ambient shell background should become brand-centric. Light mode should embrace the lighter brand colors; dark mode should embrace the darker brand colors.
- Red and amber should stay in semantic/status usage, not in the ambient page background.

## Current state

- `DESIGN.md` still defines the old brand set: `brand-sky*`, `brand-emerald*`, `brand-cyan*`, `brand-violet*`, `brand-rose*`, and `brand-amber*`.
- `frontend/src/ui/generated/tokens.ts`, `frontend/src/ui/generated/tokens.dtcg.json`, and `frontend/src/ui/generated/theme.css` are generated from `DESIGN.md`.
- `frontend/src/ui/tokens.ts` exposes app-facing hue names such as `HeroAccent = 'slate' | 'emerald' | 'sky' | 'violet' | 'amber' | 'rose'` and contains hardcoded accent registries, label colors, pill gradients, and feature palettes based on the old color families.
- `frontend/src/ui/recipes.ts` still references removed CSS variables such as `--color-brand-sky` and `--color-brand-emerald`.
- `frontend/src/ui/primitives/GradientShell.tsx` carries the current ambient shell background using blue, cyan, violet, emerald, amber, and rose gradients rather than the new palette.
- Tests under `frontend/tests/ui/` and domain/component tests assert old accent names, hex values, and CSS-variable usage.

## Scope

In scope:

- Update the design token contract in `DESIGN.md`.
- Rename the base brand token vocabulary.
- Remap semantic, chart, text, border, status, and effect tokens to the new palette.
- Regenerate all generated token artifacts from `DESIGN.md`.
- Rename the frontend runtime accent API and supporting registries in `frontend/src/ui/tokens.ts`.
- Retheme shared recipes and direct consumers that still depend on old color names or variables.
- Retheme the ambient shell background gradients in `frontend/src/ui/primitives/GradientShell.tsx`.
- Update focused tests, stories, and assertions that depend on the old contract.

Out of scope:

- Changing typography, spacing, shape, or glass blur behavior.
- Introducing a compatibility alias layer for old runtime accent names.
- Retinting neutral glass surfaces away from their current neutral treatment.

## Canonical palette

Use these as the canonical base colors in `DESIGN.md`:

- `primary: #20428c`
- `on-primary: #ebeff5`
- `brand-navy: #011e5b`
- `brand-ocean: #20428c`
- `brand-azure: #0d8acc`
- `brand-glacier: #3cbbfe`
- `brand-teal: #00c2a2`
- `brand-mint: #81fed2`
- `brand-ice: #b1e4ff`
- `brand-crimson: #b82812`
- `brand-signal-red: #f53519`
- `brand-fog: #ebeff5`
- `brand-amber: #f59e0b`
- `brand-amber-dark: #fbbf24`

Remove the old brand token names from the contract once all references are migrated:

- `brand-sky`
- `brand-sky-dark`
- `brand-emerald`
- `brand-emerald-dark`
- `brand-cyan`
- `brand-cyan-dark`
- `brand-violet`
- `brand-violet-dark`
- `brand-rose`
- `brand-rose-dark`

## Old-to-new brand mapping

Use this mapping anywhere the existing design token contract, generated artifacts, runtime helpers, or shared recipes still speak in the old brand vocabulary.

| Old token | New token | Notes |
| --- | --- | --- |
| `primary` | `primary` | Value changes to `#20428c` |
| `on-primary` | `on-primary` | Value changes to `#ebeff5` |
| `brand-sky` | `brand-azure` | Main light-mode accent/info blue |
| `brand-sky-dark` | `brand-glacier` | Main dark-mode accent/info blue |
| `brand-cyan` | `brand-teal` | Cool secondary accent |
| `brand-cyan-dark` | `brand-mint` | Cool dark-mode companion |
| `brand-emerald` | `brand-teal` | Success/cash light-mode brand family |
| `brand-emerald-dark` | `brand-mint` | Success/cash dark-mode brand family |
| `brand-violet` | `brand-navy` | Premium/deeper brand family |
| `brand-violet-dark` | `brand-ocean` | Premium/deeper dark-mode companion |
| `brand-rose` | `brand-crimson` | Danger/credit light-mode family |
| `brand-rose-dark` | `brand-signal-red` | Danger/credit dark-mode companion |
| `brand-amber` | `brand-amber` | Retained for warning/loan semantics |
| `brand-amber-dark` | `brand-amber-dark` | Retained for warning/loan semantics |

Additional palette-only tokens that do not have a direct old-name predecessor:

- `brand-ice`
- `brand-fog`

## Implementation plan

### Phase 1: Replace the base token contract and semantic mappings

Goal: update `DESIGN.md` so the canonical design token contract matches the new brand system and preserves the required semantic meanings.

Tasks:

- Replace the old brand token family in `DESIGN.md` with the canonical palette above.
- Rewrite the description and color rationale text so it no longer refers to the old cyan-violet direction.
- Remap semantic tokens by meaning:
  - accent/info/focus/outline glow -> `brand-azure` light, `brand-glacier` dark
  - success/cash -> `brand-teal` light, `brand-mint` dark
  - investments -> `brand-azure` light, `brand-glacier` dark
  - loan/warning -> `brand-amber` light, `brand-amber-dark` dark
  - danger/credit -> `brand-crimson` light, `brand-signal-red` dark
  - net worth / premium accent -> `brand-navy` light, `brand-ocean` dark
  - inverse/on-dark text -> `brand-fog`
- Keep standard light-mode page text roles dark enough for readability on current neutral cards and glass surfaces.
- Rebuild the chart token ordering to stay visually distinct:
  - `chart-light`: `brand-azure`, `brand-teal`, `brand-amber`, `brand-crimson`, `brand-navy`, `brand-ocean`
  - `chart-dark`: `brand-glacier`, `brand-mint`, `brand-amber-dark`, `brand-signal-red`, `brand-ocean`, `brand-ice`
- Update text, border, status, and effect token references so none of them depend on removed brand names.

Acceptance criteria:

- [ ] `DESIGN.md` contains only the new brand token vocabulary plus retained amber warning tokens.
- [ ] `credit` is mapped to the red family and `loan` to the amber family.
- [ ] `brand-fog` is used for `on-primary` and inverse/on-dark text support, not standard light-mode body text.
- [ ] No token in `DESIGN.md` references removed names such as `brand-sky`, `brand-emerald`, `brand-violet`, `brand-cyan`, or `brand-rose`.

### Phase 2: Regenerate token artifacts and align shared runtime wrappers

Goal: regenerate the generated token outputs and update shared runtime wrappers so the repo consumes the new contract without drift.

Tasks:

- Run `bun --cwd=frontend run design:generate` after the `DESIGN.md` change.
- Refresh:
  - `frontend/src/ui/generated/tokens.ts`
  - `frontend/src/ui/generated/tokens.dtcg.json`
  - `frontend/src/ui/generated/theme.css`
- Update `frontend/src/ui/recipes.ts` to replace removed CSS variable references such as `--color-brand-sky` and `--color-brand-emerald` with the new variable names.
- Update any shared recipe tokens that still encode the old visual language through direct Tailwind hue classes where that usage belongs in shared token-aware recipes instead.
- Run `bun --cwd=frontend run design:guard` after regeneration to confirm there is no token drift.

Acceptance criteria:

- [ ] Generated token files reflect the new palette and token names.
- [ ] `frontend/src/ui/recipes.ts` no longer references removed brand CSS variables.
- [ ] `bun --cwd=frontend run design:guard` passes without manual edits to generated files.

### Phase 3: Rename the frontend runtime accent API and retheme shared accent registries

Goal: replace the old app-facing hue vocabulary with the new runtime vocabulary and keep all accent-driven helpers coherent.

Tasks:

- In `frontend/src/ui/tokens.ts`, rename the public accent vocabulary to:
  - `HeroAccent = 'slate' | 'teal' | 'azure' | 'ocean' | 'amber' | 'crimson'`
- Rename `heroAccents` keys and all direct consumer props/usages to the new vocabulary.
- Change the default hero accent fallback to `teal`.
- Replace the existing category accent registry with a palette-native set of 10 keys:
  - `azure`, `teal`, `glacier`, `ocean`, `amber`, `crimson`, `navy`, `mint`, `ice`, `signal-red`
- Update `getHeroAccentForCategoryKey()` to map category keys into hero accents:
  - `azure` and `glacier` -> `azure`
  - `teal` and `mint` -> `teal`
  - `ocean`, `navy`, and `ice` -> `ocean`
  - `amber` -> `amber`
  - `crimson` and `signal-red` -> `crimson`
- Update `accountTypeDot` to:
  - cash -> `brand-teal`
  - credit -> `brand-crimson`
  - investments -> `brand-azure`
  - loan -> `brand-amber`
- Retheme hardcoded label colors, pill gradients, feature palettes, and helper gradients in `frontend/src/ui/tokens.ts` so they no longer encode old sky/emerald/violet/rose semantics.
- Update domain mappings, widgets, stories, and components that pass or assert old accent names so they compile and behave against the renamed runtime API.

Acceptance criteria:

- [ ] No app-facing runtime type or helper uses the old hero accent names.
- [ ] Category accent registries and mappings use the new palette-native vocabulary.
- [ ] Shared accent helpers, pills, and feature palettes no longer render the old visual family.
- [ ] The frontend builds without compatibility aliases for `sky`, `emerald`, `violet`, or `rose`.

### Phase 4: Retheme the ambient shell background

Goal: make the ambient page background brand-centric while keeping glass surfaces neutral and readable.

Tasks:

- Update `frontend/src/ui/primitives/GradientShell.tsx` so the ambient shell background follows this intent:
  - light mode resolves through `brand-ice -> brand-fog -> brand-mint -> brand-glacier -> brand-ocean`
  - dark mode resolves through `brand-navy -> brand-ocean -> brand-azure -> brand-navy`
- Keep the glass system unchanged. Only the ambient shell background gradients should shift.
- Replace the current deeper premium aura with `brand-ocean` plus a smaller `brand-azure` fade.
- Replace the current brighter cool aura with `brand-glacier` plus a smaller `brand-teal` fade.
- Remove amber and red from the ambient rotating aura so the shell atmosphere stays blue/teal/ocean brand-centric.
- Use this target mapping for the gradient recipes:
  - light base radial -> `#b1e4ff -> #ebeff5 -> #81fed2 -> #3cbbfe -> #20428c`
  - dark base radial -> `#011e5b -> #20428c -> #0d8acc -> #011e5b`
  - light centered overlay -> pale `brand-ice`, strong `brand-fog`, soft `brand-mint`, then `brand-glacier` and a faint `brand-ocean`
  - dark centered overlay -> `brand-navy`, `brand-ocean`, faint `brand-azure`, back to `brand-navy`
  - premium aura replacement -> `brand-ocean` with `brand-azure`
  - cool aura replacement -> `brand-glacier` with `brand-teal`
  - light vignette -> `brand-fog` first, then `brand-ice`
  - rotating aura -> `brand-glacier -> brand-mint -> brand-fog -> brand-teal -> brand-azure -> brand-ocean -> brand-glacier`
- Preserve the current structural layering: base radial, centered overlay, two aura layers, rotating center glow, vignette, and vignette overlay.

Acceptance criteria:

- [ ] Light mode background visibly folds brighter brand color into `brand-fog`.
- [ ] Dark mode background stays entirely inside the darker brand families.
- [ ] Glass surfaces remain neutral on top of the new background.
- [ ] The ambient shell no longer uses the old violet/cyan/emerald/rose gradient system.

### Phase 5: Regression coverage and verification

Goal: prove the renamed color system, generated artifacts, runtime helpers, and shell background all moved together without drift.

Tasks:

- Update token runtime tests to the new names and hex values.
- Update recipe tests that currently assert old brand CSS variables such as `--color-brand-sky` and `--color-brand-emerald`.
- Update component and domain tests that assert old accent names, old gradient strings, or old account/category accent values.
- Run focused validation:
  - `bun --cwd=frontend run design:lint`
  - `bun --cwd=frontend run design:generate`
  - `bun --cwd=frontend run design:guard`
  - `bun --cwd=frontend run typecheck`
  - `bun --cwd=frontend run test -- --runTestsByPath tests/ui/tokens/runtime.test.ts tests/ui/tokens/status.test.ts tests/ui/tokens/effects.test.ts tests/ui/recipes.test.ts`
- Run the focused component/domain tests that cover buttons, icon buttons, title bar, footer, hero accent widgets, and account category mapping.
- Perform a visual check of the shell background in both color modes to confirm the gradient direction matches the agreed brand-centric intent.

Acceptance criteria:

- [ ] Focused token, recipe, and component/domain coverage passes against the new palette contract.
- [ ] `typecheck` passes after the runtime accent rename.
- [ ] No remaining test or source assertion depends on removed public color names where those names were part of the runtime API.
- [ ] Light and dark shell backgrounds visually match the agreed brand direction.

## Risks

- The generated token pipeline and shared runtime wrappers are tightly coupled; partial migration will leave broken variable references or design drift.
- The runtime API rename affects stories, widgets, domain mappings, and tests, so incomplete consumer updates will break build or typecheck.
- The ambient shell uses hardcoded gradient strings, so a palette swap that ignores those strings will leave the page atmosphere visually inconsistent with the new brand system.
- `brand-fog` can easily be over-applied. If it is used as general light-mode body text, contrast will degrade on existing light surfaces.

## Assumptions

- The new palette fully replaces the old brand families except for the retained amber warning pair.
- `brand-fog` belongs in inverse/on-dark text roles and the light ambient background, not standard light-mode content text.
- The shell background should become brand-centric without changing the neutral glass treatment.
- The student agent implementing this work can use `DESIGN.md` as the source of truth and should not hand-edit generated token files.

## Next actions

1. Update `DESIGN.md` with the new canonical palette and semantic remap.
2. Regenerate the frontend token artifacts and remove shared recipe references to old token names.
3. Rename the runtime accent API and retheme `frontend/src/ui/tokens.ts`.
4. Retheme `GradientShell.tsx` to the agreed ambient brand gradient mapping.
5. Update focused tests and run the validation commands listed above.
