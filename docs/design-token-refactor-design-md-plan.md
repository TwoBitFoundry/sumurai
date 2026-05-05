# Sumurai Design Token Refactor For DESIGN.md

## Summary

Refactor Sumurai into a clean internal design token system first, then express that system in the `DESIGN.md` standard. The `design.md` CLI is already available globally, so implementation should use `designmd` directly instead of adding `@google/design.md` as a project dependency.

The goal is to preserve the current visual identity while removing scattered hard-coded brand values from shared UI code and creating a clean handoff path for SwiftUI.

## Phase 1: Internal Token Refactor

- Create `frontend/src/ui/tokens/` with typed tokens for colors, typography, radii, spacing, shadows, gradients, motion, finance semantics, chart colors, and category accents.
- Refactor shared UI to consume tokens: `ThemeContext`, Tailwind config, primitives, page layout, title bar, hero stat cards, category pills, progress bars, and charts.
- Remove random hard-coded brand, surface, semantic, chart, gradient, and shadow colors from core UI files.
- Keep raw brand values only in token files or token bridge/config files.
- Preserve current visuals and component behavior.

Completed: added the typed token module and Tailwind bridge, refactored the shared UI surfaces to consume tokens, and kept the public theme hook behavior intact.

### TDD Log

- Red: added token and theme-context tests before implementation.
- Green: implemented the token module, refactored the shared UI, and updated the affected snapshots.
- Verify: `npm --prefix frontend run typecheck`, `npm --prefix frontend test`, `npm --prefix frontend run build`.

## Phase 2: Document The DESIGN.md Standard

- Add `docs/design-md-standard.md` explaining:
  - The standard is `DESIGN.md` from `google-labs-code/design.md`.
  - Official repo: <https://github.com/google-labs-code/design.md>
  - Full spec: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md>
  - CLI command is globally available as `designmd`.
- Include the required structure:
  - YAML front matter contains normative machine-readable tokens.
  - Markdown body contains human-readable rationale.
  - Canonical section order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts.
- Include exact validation/export commands:
  - `designmd lint DESIGN.md`
  - `designmd export --format dtcg DESIGN.md`
  - `designmd export --format css-tailwind DESIGN.md`
  - `designmd diff DESIGN.md DESIGN-v2.md`
  - `designmd spec --rules`

Completed: documented the standard, required file structure, canonical section order, and validation/export commands in `docs/design-md-standard.md`.

### TDD Log

- Red: no code changes were needed for this documentation slice.
- Green: added the standards document.
- Verify: pending.

## Phase 3: Add DESIGN.md

- Add root `DESIGN.md` only after the internal token model is coherent.
- Map frontend tokens into `DESIGN.md` YAML front matter using the standard token groups:
  - `colors`
  - `typography`
  - `rounded`
  - `spacing`
  - `components`
- Use Markdown prose to explain Sumurai's dark-first glass financial UI, cyan-violet brand gradient, semantic finance colors, compact uppercase labels, panel depth, and SwiftUI mapping guidance.
- Do not encode messy historical implementation details. `DESIGN.md` should describe the cleaned token system.

Completed: added a root `DESIGN.md` with spec-shaped front matter and Markdown guidance that mirrors the cleaned frontend token system.

### TDD Log

- Red: no implementation tests were needed for the documentation-only root file.
- Green: rewrote the root design document to use the spec token schema and aligned prose with Sumurai's visual system.
- Verify: `node /opt/homebrew/lib/node_modules/@google/design.md/dist/index.js lint DESIGN.md` passed with warnings only.

## Phase 4: Add Validation Scripts

- Do not add `@google/design.md` to `package.json`.
- Add frontend package scripts that call the global CLI:
  - `design:lint`: `designmd lint ../DESIGN.md`
  - `design:export:dtcg`: `designmd export --format dtcg ../DESIGN.md`
  - `design:export:tailwind`: `designmd export --format css-tailwind ../DESIGN.md`
  - `design:spec`: `designmd spec --rules`
- Generate export artifacts only after `DESIGN.md` validates.

Completed: added frontend scripts and a local `designmd` shim so the package can call the installed global CLI without adding the package as a dependency.

### TDD Log

- Red: the first shim attempt resolved the wrong npm root path.
- Green: added a local executable shim and wired the frontend scripts to it.
- Verify: `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, and `npm --prefix frontend run design:spec` all completed successfully after the shim fix.

## Acceptance Criteria

- The frontend has one clear token API for Sumurai visual decisions.
- Core UI files no longer define random raw brand, surface, semantic finance, chart, gradient, or shadow colors inline.
- `docs/design-md-standard.md` identifies the official standard, spec URL, global CLI command, validation commands, export commands, and section order.
- Root `DESIGN.md` validates with `designmd lint DESIGN.md`.
- `DESIGN.md` maps cleanly to the internal token names and provides SwiftUI-readable guidance.
- Existing visuals still match the provided screenshots:
  - dark glass panels
  - cyan-violet active navigation
  - branded aura background
  - compact uppercase pills
  - rounded stat cards
  - semantic finance colors
- `ThemeContext` keeps its existing public hook behavior.
- Category-to-color assignment remains stable.
- No source comments are added.
- No `.env` files are read or written.

## Test Plan

- Run `npm --prefix frontend run typecheck`.
- Run `npm --prefix frontend test`.
- Run `npm --prefix frontend run build`.
- Run `designmd lint DESIGN.md`.
- Run `designmd export --format dtcg DESIGN.md`.
- Run `designmd export --format css-tailwind DESIGN.md`.

## Assumptions

- Internal frontend tokens are the refactor target; `DESIGN.md` is the standards-compliant expression of that cleaned system.
- The first implementation pass should prioritize core/shared UI surfaces over every legacy one-off style.
- Remaining hard-coded colors are acceptable only for non-brand implementation details or explicit third-party glue, and must be called out in the final implementation summary.
- The global `designmd` CLI is available in the developer environment.

## Next Actions

- Start with the internal token module and refactor `ThemeContext` plus shared UI primitives before writing `DESIGN.md`.
- After the token API stabilizes, add `docs/design-md-standard.md` and root `DESIGN.md`.
- Add global-CLI package scripts last, then run the full validation set.
