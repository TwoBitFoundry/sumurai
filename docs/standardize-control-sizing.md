# Standardize Control Sizing & Labels (Apple HIG-aligned)

## Context

Sumurai's primitives have drifted into inconsistent size systems:

- **Button**: 5 sizes (`xs`, `sm`, `md`, `lg`, `icon`) — `xs`/`sm` share the same chrome, `md`/`lg` use hard-coded `px-4 py-2` / `px-5 py-2.5`, `icon` is a fixed 40×40 (fails Apple HIG 44pt touch-target minimum).
- **Input / Select**: 3 sizes (`sm`, `md`, `lg`) with `py-1.5` / `py-2.5` / `py-3` — no shared scale with Button, no glyph pairing.
- **IconButton**: no size variants — fixed `p-2`.
- **No glyph sizing scale** anywhere — icon sizes are ad-hoc per consumer.
- **No label/typography mapping per control size**.

Goal: one Apple HIG-derived, breakpoint-aware control scale (`sm` / `md` / `lg`) that every interactive primitive consumes. Default `md` meets the 44pt iOS touch target on mobile, relaxes to macOS-style 36px on tablet, 32px on desktop. Glyph size and label typography are paired to each control size.

**Architectural placement:** the scale lives in [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts), not DESIGN.md. DESIGN.md holds primitive design intent (colors, typography, spacing, radius). `recipes.ts` is where primitives are composed into reusable class atoms — `buttonChrome`, `chrome`, `font`, `radius` already follow this pattern. No DESIGN.md schema change, no `design:guard` pipeline change.

## Reference Scale

### Control height

| Size | Mobile (`< md`) | Tablet (`md:`) | Desktop (`lg:`) | Apple HIG basis |
|------|----------------|----------------|------------------|------------------|
| `sm` | 36px           | 32px           | 28px             | macOS "small" / dense toolbar |
| `md` | 44px           | 36px           | 32px             | iOS minimum touch target / macOS "regular" |
| `lg` | 52px           | 44px           | 40px             | iOS prominent action / macOS "large" |

### Glyph (icon) size

| Size | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| `sm` | 16px   | 16px   | 14px    |
| `md` | 20px   | 18px   | 16px    |
| `lg` | 24px   | 22px   | 20px    |

### Horizontal padding

| Size | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| `sm` | 12px   | 10px   | 10px    |
| `md` | 16px   | 14px   | 12px    |
| `lg` | 20px   | 18px   | 16px    |

### Label typography pairing (reuses existing `font.*` recipes)

| Size | Recipe              | Source                              | Effective |
|------|---------------------|-------------------------------------|-----------|
| `sm` | `font.captionStrong`| `typography.caption` + weight 600   | 14px / 600 |
| `md` | `font.bodyStrong`   | `typography.body-strong`            | 16px / 600 |
| `lg` | `font.bodyStrong`   | `typography.body-strong`            | 16px / 600 |

---

## Handoff to phase-implementer

Each phase is independently testable and may be implemented in order. Use strict TDD (red → green → refactor) per the `phase-implementer` skill. Tests live under `frontend/tests/**`, never inline with source (per project [CLAUDE.md](CLAUDE.md)). Boundary-only testing applies: assert rendered classnames / DOM attributes / accessibility output, not internal state.

After each phase, run `npm --prefix frontend test` and commit before moving on.

---

## Phase 1 — Add `control` recipe to `recipes.ts`

### Goal
Introduce a single source of truth for control sizing in [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts). All later phases consume from this recipe; nothing else changes yet.

### Tasks
1. **Red**: add [frontend/tests/ui/recipes.test.ts](frontend/tests/ui/recipes.test.ts) (or extend the existing recipes test file if present). Assert that `control.height.sm/md/lg`, `control.square.sm/md/lg`, `control.glyph.sm/md/lg`, `control.paddingX.sm/md/lg`, and `control.label.sm/md/lg` exist and emit the expected breakpoint-aware Tailwind class strings (e.g. `control.height.md === 'h-11 md:h-9 lg:h-8'`, `control.label.sm === font.captionStrong`).
2. **Green**: add the `control` export at the bottom of [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts):

   ```ts
   export const control = {
     height: {
       sm: 'h-9 md:h-8 lg:h-7',
       md: 'h-11 md:h-9 lg:h-8',
       lg: 'h-[52px] md:h-11 lg:h-10',
     },
     square: {
       sm: 'h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7',
       md: 'h-11 w-11 md:h-9 md:w-9 lg:h-8 lg:w-8',
       lg: 'h-[52px] w-[52px] md:h-11 md:w-11 lg:h-10 lg:w-10',
     },
     glyph: {
       sm: 'h-4 w-4 lg:h-3.5 lg:w-3.5',
       md: 'h-5 w-5 md:h-[18px] md:w-[18px] lg:h-4 lg:w-4',
       lg: 'h-6 w-6 md:h-[22px] md:w-[22px] lg:h-5 lg:w-5',
     },
     paddingX: {
       sm: 'px-3 md:px-2.5 lg:px-2.5',
       md: 'px-4 md:px-3.5 lg:px-3',
       lg: 'px-5 md:px-[18px] lg:px-4',
     },
     label: {
       sm: font.captionStrong,
       md: font.bodyStrong,
       lg: font.bodyStrong,
     },
   } as const;
   ```
3. **Refactor**: confirm the export is alphabetized/ordered to match the file's existing convention; add no comments.

### Acceptance criteria
- [x] `control` export exists in [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts) with the five sub-maps (`height`, `square`, `glyph`, `paddingX`, `label`).
- [x] New recipe tests pass: `npm --prefix frontend test -- ui/recipes`.
- [x] No primitive or call-site files are touched in this phase.
- [x] `npm --prefix frontend run build` succeeds (no type errors).

### Files
- [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts)
- [frontend/tests/ui/recipes.test.ts](frontend/tests/ui/recipes.test.ts) *(new or extended)*

### TDD log
- Red: extended the shared recipes spec to assert the new `control` shape and exact class strings.
- Green: added `control` to `frontend/src/ui/recipes.ts` with the Apple HIG-derived control scale.
- Verify: `npm --prefix frontend test -- ui/recipes` passed, then `npm --prefix frontend run build` passed.

---

## Phase 2 — Refactor `Button` to consume `control`

### Goal
Collapse Button's size variants to `sm` / `md` / `lg`, remove `xs` and `icon`, and add a `shape: 'square'` prop. All sizing flows from `control.*`.

### Tasks
1. **Red**: update [frontend/tests/ui/primitives/Button.test.tsx](frontend/tests/ui/primitives/Button.test.tsx) (create if missing) to assert:
   - `<Button size="sm">` renders with `h-9 md:h-8 lg:h-7` and `font.captionStrong` classes.
   - `<Button size="md">` renders with `h-11 md:h-9 lg:h-8` and `font.bodyStrong` classes.
   - `<Button size="lg">` renders with `h-[52px] md:h-11 lg:h-10` and `font.bodyStrong` classes.
   - `<Button shape="square" size="md">` renders square classes from `control.square.md`.
   - `<Button>` (no size) defaults to `md`.
2. **Green**: in [frontend/src/ui/primitives/Button.tsx](frontend/src/ui/primitives/Button.tsx):
   - Import `control` from `@/ui/recipes`.
   - Replace the `size` variant block (lines 158–165) so each entry composes `control.height[size] + ' ' + control.paddingX[size] + ' ' + control.label[size] + ' ' + uiRadiusRecipes.standard`.
   - Drop `xs` and `icon` from the `size` union. Keep `titleBarExpanded` untouched.
   - Add a `shape` variant: `{ default: '', square: ... }` where `square` resolves to `control.square[size]` (use a `compoundVariants` block in `cva` so `shape="square"` overrides the rectangular `height + paddingX` mapping).
   - Update the `buttonTypographySizes` export to remove `xs` and align values with `control.label`.
3. **Refactor**: remove now-unused imports (`chrome.xs`, `chrome.sm` if no longer referenced); ensure no comments are introduced.

### Acceptance criteria
- [x] Button's `size` prop type is `'sm' | 'md' | 'lg' | 'titleBarExpanded'`.
- [x] Button supports `shape?: 'default' | 'square'`, defaulting to `'default'`.
- [x] No call site in the repo still uses `size="xs"` or `size="icon"` (verified later in Phase 7).
- [x] All Button tests pass: `npm --prefix frontend test -- primitives/Button`.
- [x] `npm --prefix frontend run build` succeeds.

### Files
- [frontend/src/ui/primitives/Button.tsx](frontend/src/ui/primitives/Button.tsx)
- [frontend/tests/ui/primitives/Button.test.tsx](frontend/tests/ui/primitives/Button.test.tsx)

### TDD log
- Red: added a new Button spec covering default sizing, each control tier, and the square shape.
- Green: refactored Button to consume `control`, added `shape`, and migrated the remaining legacy Button call sites to the new size and icon primitives so TypeScript could pass.
- Verify: `npm --prefix frontend test -- primitives/Button`, `npm --prefix frontend test -- ui/primitives/typography`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` all passed.

---

## Phase 3 — Refactor `Input` to consume `control`

### Goal
Replace Input's bespoke size scale with the shared `control.*` mapping. Visual height for `Input inputSize="md"` matches `Button size="md"` at every breakpoint.

### Tasks
1. **Red**: update [frontend/tests/ui/primitives/Input.test.tsx](frontend/tests/ui/primitives/Input.test.tsx) to assert that each `inputSize` renders `control.height[size]`, `control.paddingX[size]`, `control.label[size]`, and `radius.standard`.
2. **Green**: in [frontend/src/ui/primitives/Input.tsx](frontend/src/ui/primitives/Input.tsx) replace `inputControl.size` (lines 64–68) with:

   ```ts
   size: {
     sm: `${control.height.sm} ${control.paddingX.sm} ${control.label.sm} ${uiRadiusRecipes.standard}`,
     md: `${control.height.md} ${control.paddingX.md} ${control.label.md} ${uiRadiusRecipes.standard}`,
     lg: `${control.height.lg} ${control.paddingX.lg} ${control.label.lg} ${uiRadiusRecipes.standard}`,
   },
   ```
   Remove the hard-coded `px-4` from `inputControl.base` (now provided by `control.paddingX`).
3. **Refactor**: verify the `inputSize` React prop name remains (avoids HTML `size` collision); only the internal class mapping changes.

### Acceptance criteria
- [x] All three `inputSize` variants produce classnames composed from `control.*`.
- [x] Input tests pass.
- [x] `<Button size="md">` and `<Input inputSize="md">` rendered together share identical height classes.

### Files
- [frontend/src/ui/primitives/Input.tsx](frontend/src/ui/primitives/Input.tsx)
- [frontend/tests/ui/primitives/Input.test.tsx](frontend/tests/ui/primitives/Input.test.tsx)

### TDD log
- Red: added a focused Input spec for all three control tiers and the shared Button height.
- Green: refactored Input to consume `control.height`, `control.paddingX`, and `control.label` while removing the old `px-4` base padding.
- Verify: `npm --prefix frontend test -- ui/primitives/Input`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` all passed.

---

## Phase 4 — Refactor `Select` to mirror `Input`

### Goal
Apply the same `control.*` mapping to Select so form fields align.

### Tasks
1. **Red**: add/extend [frontend/tests/ui/primitives/Select.test.tsx](frontend/tests/ui/primitives/Select.test.tsx) to assert `control.*` classes per size.
2. **Green**: edit [frontend/src/ui/primitives/Select.tsx](frontend/src/ui/primitives/Select.tsx) to import `control` and apply the same `height + paddingX + label + radius.standard` composition used in Input.
3. **Refactor**: deduplicate any size logic that now exists identically in Input and Select — if both consume `control.*` directly, no shared helper is needed.

### Acceptance criteria
- [x] Select tests pass.
- [x] `<Select size="md">` height matches `<Input inputSize="md">` and `<Button size="md">`.

### Files
- [frontend/src/ui/primitives/Select.tsx](frontend/src/ui/primitives/Select.tsx)
- [frontend/tests/ui/primitives/Select.test.tsx](frontend/tests/ui/primitives/Select.test.tsx)

### TDD log
- Red: added a Select spec for all control tiers and the shared Button height.
- Green: refactored Select to consume `control.height`, `control.paddingX`, and `control.label` directly instead of delegating to Input's recipe object.
- Verify: `npm --prefix frontend test -- ui/primitives/Select`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` all passed.

---

## Phase 5 — Add `size` variant to `IconButton`

### Goal
IconButton gains `size: 'sm' | 'md' | 'lg'` (default `md`), uses `control.square[size]` for the shell, and auto-sizes children via `control.glyph[size]`.

### Tasks
1. **Red**: extend [frontend/tests/ui/primitives/IconButton.test.tsx](frontend/tests/ui/primitives/IconButton.test.tsx) (create if missing) to assert:
   - Default `<IconButton>` renders `control.square.md`.
   - `size="sm" | "md" | "lg"` renders the corresponding `control.square[size]`.
   - Children are wrapped in a `<span>` with `control.glyph[size]` classes.
2. **Green**: in [frontend/src/ui/primitives/IconButton.tsx](frontend/src/ui/primitives/IconButton.tsx):
   - Add a `size` variant to `iconButtonVariants` (default `'md'`).
   - Replace `p-2` in every recipe entry with `control.square[size]`.
   - Wrap `children` in `<span className={control.glyph[size]}>{children}</span>` so consumers don't size icons manually.
3. **Refactor**: remove the now-redundant `p-2` literals; ensure the four variant recipes (`ghost`, `primary`, `success`, `danger`) all keep their colour/shadow chrome.

### Acceptance criteria
- [x] `IconButton` accepts `size?: 'sm' | 'md' | 'lg'`, defaults to `'md'`.
- [x] Default IconButton is ≥ 44 × 44 px on mobile viewport (passes Apple HIG touch target).
- [x] IconButton tests pass.

### Files
- [frontend/src/ui/primitives/IconButton.tsx](frontend/src/ui/primitives/IconButton.tsx)
- [frontend/tests/ui/primitives/IconButton.test.tsx](frontend/tests/ui/primitives/IconButton.test.tsx)

### TDD log
- Red: added a focused IconButton spec for the default shell, all three sizes, and glyph wrapping.
- Green: refactored IconButton to consume `control.square` for the shell and `control.glyph` for the wrapped child content.
- Verify: `npm --prefix frontend test -- ui/primitives/IconButton`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` all passed.

---

## Phase 6 — Audit `PaginationButton` and `Pill`

### Goal
Migrate any interactive primitive that bypassed the new scale.

### Tasks
1. **Red**: extend [frontend/tests/ui/primitives/PaginationButton.test.tsx](frontend/tests/ui/primitives/PaginationButton.test.tsx) (create if missing) to assert it uses `control.square.sm`.
2. **Green**: in [frontend/src/ui/primitives/PaginationButton.tsx](frontend/src/ui/primitives/PaginationButton.tsx), replace any raw `h-*` / `w-*` / `p-*` on the interactive shell with `control.square.sm`. Leave label typography alone if it already uses `font.*`.
3. **Audit**: read [frontend/src/ui/primitives/Pill.tsx](frontend/src/ui/primitives/Pill.tsx). If Pill is purely decorative (no `onClick`, not focusable), document "no change" in the commit message. If interactive, migrate to `control.height.sm` + `control.paddingX.sm`.

### Acceptance criteria
- [x] PaginationButton consumes `control.square.sm`.
- [x] Pill is either confirmed decorative (no change) or migrated.
- [x] Tests pass.

### Files
- [frontend/src/ui/primitives/PaginationButton.tsx](frontend/src/ui/primitives/PaginationButton.tsx)
- [frontend/src/ui/primitives/Pill.tsx](frontend/src/ui/primitives/Pill.tsx) *(read; edit only if interactive)*
- [frontend/tests/ui/primitives/PaginationButton.test.tsx](frontend/tests/ui/primitives/PaginationButton.test.tsx)

### TDD log
- Red: added a focused PaginationButton spec for the shared small square shell.
- Green: pinned PaginationButton to `control.square.sm` via `IconButton` and confirmed `Pill` remains decorative.
- Verify: `npm --prefix frontend test -- ui/primitives/PaginationButton`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` all passed.

---

## Phase 7 — Migrate call sites & enforce grep gate

### Goal
Remove every legacy usage so the new scale is the only path.

### Tasks
1. **Red**: add a guard test ([frontend/tests/ui/no-legacy-sizes.test.ts](frontend/tests/ui/no-legacy-sizes.test.ts)) that fails if any source file under `frontend/src/**` contains `size="xs"` or `variant="icon" size="icon"`. (Use `fs.readdirSync` + regex; this is a build-time gate, not a runtime behaviour test.)
2. **Green**: for each match found by `rg 'size="xs"|variant="icon"' frontend/src`, replace:
   - `<Button size="xs" …>` → `<Button size="sm" …>`.
   - `<Button variant="icon" size="icon">…</Button>` → `<IconButton variant="ghost" size="md">…</IconButton>` (or the closest semantic match).
3. **Audit raw heights**: `rg '\\bh-(8|9|10)\\b' frontend/src/components frontend/src/features frontend/src/layouts` — replace interactive uses with `control.square.*` / `control.height.*`. Skip decorative chips/avatars.

   Known likely sites:
   - [frontend/src/components/HeaderAccountFilter.tsx](frontend/src/components/HeaderAccountFilter.tsx)
   - [frontend/src/components/ThemeModeSelector.tsx](frontend/src/components/ThemeModeSelector.tsx)
   - [frontend/src/ui/primitives/AppTitleBar.tsx](frontend/src/ui/primitives/AppTitleBar.tsx)
   - [frontend/src/features/transactions/components/TransactionsToolbar.tsx](frontend/src/features/transactions/components/TransactionsToolbar.tsx)
   - [frontend/src/features/transactions/components/TransactionsSearchBar.tsx](frontend/src/features/transactions/components/TransactionsSearchBar.tsx)
4. **Refactor**: re-run the guard test; it must pass.

### Acceptance criteria
- [x] `rg 'size="xs"|variant="icon"' frontend/src` returns zero results.
- [x] Guard test passes.
- [x] Full frontend suite passes: `npm --prefix frontend test`.
- [x] Storybook smoke passes: `npm --prefix frontend run test:storybook-runtime`.

### Files
- All matched call sites under `frontend/src/**`
- [frontend/tests/ui/no-legacy-sizes.test.ts](frontend/tests/ui/no-legacy-sizes.test.ts) *(new)*

### TDD log
- Red: added a repo-level guard test to catch legacy Button sizing patterns in source.
- Green: migrated the remaining interactive call sites, including the transactions search bar spacing polish for desktop and tablet.
- Verify: `npm --prefix frontend test -- ui/no-legacy-sizes`, `npm --prefix frontend test -- features/transactions/components/TransactionsSearchBar`, `npm --prefix frontend test`, and `npm --prefix frontend run test:storybook-runtime` all passed.

---

## Phase 8 — Document the scale in primitives README

### Goal
Codify the rules so future contributors don't re-introduce drift.

### Tasks
1. Update [frontend/src/ui/primitives/README.md](frontend/src/ui/primitives/README.md) with:
   - The three-tier scale table (height / glyph / padding / label) from this plan's "Reference Scale" section.
   - The three rules:
     1. Always pick a control `size` (`sm` / `md` / `lg`). Never hand-style heights, glyph sizes, or label typography.
     2. Pair label and glyph automatically by setting `size` on the primitive; do not override `text-*` or icon `h-*` classes downstream.
     3. Default to `md`. Use `sm` only for dense toolbars/tables. Use `lg` only for hero CTAs.
   - The Apple HIG rationale (one sentence: iOS minimum touch target = 44pt, drives mobile `md = 44px`).
2. Cross-link from the README to [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts) `control` export.

### Acceptance criteria
- [x] README documents the scale table and the three rules.
- [x] README references `control` in `recipes.ts` as the implementation source.
- [x] No code changes in this phase.

### Files
- [frontend/src/ui/primitives/README.md](frontend/src/ui/primitives/README.md)

### TDD log
- Red: reviewed the primitives README to identify the stale Button sizing guidance and missing control-scale guidance.
- Green: added the shared control-scale reference, rules, and Button API updates.
- Verify: documentation-only update; no additional test command required.

---

## Cross-cutting verification (run after final phase)

1. `npm --prefix frontend test` — full unit suite green.
2. `npm --prefix frontend run storybook:test` — Storybook smoke green at mobile/tablet/desktop viewports.
3. Manual browser pass at `http://localhost:8080` (Nginx-backed; never `:3001` — per project [CLAUDE.md](CLAUDE.md)):
   - Resize viewport across `< 768`, `768–1023`, `≥ 1024`; control heights step down accordingly.
   - In any form, `Button size="md"` and `Input inputSize="md"` are pixel-aligned in height.
   - On a mobile viewport, every icon-only button reports ≥ 44 × 44 px in DevTools.
4. Lighthouse/axe on a representative page — no "tap target too small" warnings on mobile.
5. `rg 'size="xs"|variant="icon"|\\bh-10\\b' frontend/src/components frontend/src/features` — zero interactive matches.

## Reused (do not duplicate)

- [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts) `font.captionStrong` / `font.bodyStrong` — label sources, not redeclared.
- [frontend/src/ui/recipes.ts](frontend/src/ui/recipes.ts) `radius.standard` — control radius, unchanged.
- DESIGN.md `typography.*` — untouched.
- `design:guard` pipeline — untouched.
