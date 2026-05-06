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

## Phase 5: Feature Component Extraction

- Move repeated visual structures out of views and into feature components for accounts provider selection, provider loading/error surfaces, connection summary panels, budget utilization summary, month controls, budget list toolbar, budget card actions, transaction filters/table chrome, and dashboard widget shells.
- Keep views responsible only for page orchestration, state wiring, route/tab conditionals, and feature composition.
- Replace feature-specific buttons such as `ConnectButton` with the shared `Button` primitive using a `connect` variant or a small behavior-only wrapper.
- Remove raw colors, arbitrary gradients, one-off shadows, and bespoke rounded values from views unless explicitly approved as local exceptions.

Acceptance criteria:

- `frontend/src/views/*` files mostly compose layouts, hooks, and feature components.
- Accounts, budgets, transactions, and dashboard repeated UI chrome is owned by feature components or primitives.
- New components live in existing `features`, `components`, or `layouts` folders according to current separation rules.
- `ConnectButton` no longer owns unique visual styling separate from `Button`.
- Searches for raw hex, arbitrary gradients, arbitrary shadows, and bespoke rounded values in views return none or only approved exceptions.
- Existing page behavior remains unchanged in tests.
- Focused feature tests, affected page tests, full frontend test suite, and typecheck pass.

## Phase 6: Guardrails And Visual Coverage

- Add lint/check scripts that block new raw hex values, arbitrary gradients, arbitrary shadows, and token drift outside approved files.
- Add tests under `frontend/tests` for token generation/drift, primitive variants, public primitive prop compatibility, and extracted feature component rendering.
- Add Storybook for primitives and key feature components.
- Add stories for light/dark, loading, empty, invalid, disabled, overflow, and dense-data states.
- Add visual regression through Chromatic or Playwright screenshots.

Acceptance criteria:

- CI or precommit catches token drift before merge.
- CI or precommit catches new disallowed raw styling outside approved files.
- Storybook runs locally and includes the main primitives plus selected account, budget, transaction, and dashboard feature components.
- Visual regression covers primitive states and at least one full-page smoke path.
- A student agent can run one documented validation sequence and know whether the refactor is complete.
- Final validation passes: `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run build`.

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

- Start with the token pipeline foundation and generate artifacts from the current `DESIGN.md`.
- Refactor `DESIGN.md` only after the generator path exists, so validation and exports can guide the document shape.
- Keep each implementation step small enough to run focused tests and preserve the current visual identity.
