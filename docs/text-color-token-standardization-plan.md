# Text Color Token Standardization Plan

## Summary

Standardize frontend text colors around semantic design-token roles while preserving the current light and dark visual output. Treat `DESIGN.md` as the source of truth for semantic text color intent, generate implementation artifacts from it, and use runtime recipes to migrate away from repeated ad hoc text classes.

## Source Of Truth And Validation

- `DESIGN.md` is the canonical design contract for semantic text color roles and their intended meaning.
- Generated artifacts must be produced from `DESIGN.md`, not hand-authored independently:
  - `frontend/src/ui/tokens/generated/tokens.dtcg.json`
  - `frontend/src/ui/tokens/generated/tokens.ts`
  - `frontend/src/ui/tokens/generated/theme.css`
- Runtime implementation recipes live in `frontend/src/ui/tokens/index.ts` and primitive or feature token recipe files.
- Available validation tools:
  - `npm --prefix frontend run design:lint`
  - `npm --prefix frontend run design:export:dtcg`
  - `npm --prefix frontend run design:export:tailwind`
  - `npm --prefix frontend run design:drift`
  - `npm --prefix frontend run design:styling`
  - `npm --prefix frontend run design:guard`
  - `npm --prefix frontend run typecheck`
  - Focused Jest tests under `frontend/tests/ui/`

## Phase 1: Token Foundation

Add global semantic text color roles to `DESIGN.md` using current equivalent colors:

- `text-primary`: main headings and strong data.
- `text-body`: readable copy.
- `text-muted`: supporting metadata.
- `text-subtle`: disabled or low-priority text.
- `text-label`: labels and eyebrows.
- `text-inverse`: text on saturated or gradient surfaces.
- `text-accent`: interactive or brand links.
- `text-danger`, `text-success`, `text-warning`, `text-info`: state text.

Implementation details:

- Regenerate token artifacts from `DESIGN.md` through the existing design-token pipeline.
- Expose runtime recipes such as `designTokens.text.primary`, `body`, `muted`, `subtle`, `label`, `inverse`, `accent`, and state roles.
- Add token tests that lock role names and representative class mappings.

Acceptance criteria:

- `DESIGN.md` contains semantic text roles without becoming a Tailwind class warehouse.
- Generated token files are in sync with `DESIGN.md`.
- `designTokens.text.*` exists and is type-safe.
- Token tests fail if a required text role is removed.
- `design:lint`, `design:export:dtcg`, `design:export:tailwind`, `design:drift`, focused token tests, and `typecheck` pass.

Completed:

- Added semantic text color roles to `DESIGN.md` as paired light and dark color tokens.
- Regenerated `frontend/src/ui/tokens/generated/tokens.dtcg.json`, `frontend/src/ui/tokens/generated/tokens.ts`, and `frontend/src/ui/tokens/generated/theme.css`.
- Added `designTokens.text` runtime recipes in `frontend/src/ui/tokens/index.ts`.
- Added focused token coverage in `frontend/tests/ui/tokens/text.test.ts`.
- `design:lint` passes with warnings for unused color tokens; errors remain at zero.

### TDD Log

- Red: added `frontend/tests/ui/tokens/text.test.ts` and confirmed it failed against the current token map.
- Green: added the semantic text tokens to `DESIGN.md`, regenerated the design artifacts, and exposed `designTokens.text` from the runtime token layer.
- Verify: `npm --prefix frontend run design:generate`, `npm --prefix frontend test -- frontend/tests/ui/tokens/text.test.ts`, `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, `npm --prefix frontend run design:drift`, and `npm --prefix frontend run typecheck`.

## Phase 2: Shared Primitives And Recipes

Replace hard-coded text classes in primitives and central recipes first:

- `frontend/src/ui/primitives/tokenRecipes.ts`
- Input and select recipes in `frontend/src/ui/tokens/index.ts`
- `FormLabel`, `Alert`, `Amount`, page layout, empty state, badge, buttons, and app title bar recipes

Implementation details:

- Keep component APIs unchanged unless an existing tone or variant already maps cleanly to text roles.
- Prefer `designTokens.text.*` recipes over caller-provided ad hoc class strings.

Acceptance criteria:

- Shared primitives no longer define repeated `text-slate-*`, `dark:text-slate-*`, `text-red-*`, or `dark:text-red-*` for common roles.
- Primitive output remains visually equivalent in light and dark mode.
- Existing primitive and typography tests pass.
- New text token tests verify primitives consume semantic roles for common body, muted, label, inverse, and state text.
- No source comments are added.

Completed:

- Moved shared primitive copy roles onto `semanticTextRecipes` in `frontend/src/ui/primitives/tokenRecipes.ts`.
- Updated central input and select recipes plus hero stat card text roles in `frontend/src/ui/tokens/index.ts`.
- Updated `FormLabel`, `Alert`, `RequirementPill`, `Amount`, and `AppTitleBar` to use semantic text roles.
- Extended primitive typography coverage and added a focused `Amount` test.
- Preserved the current visual tone while reducing repeated slate and red text classes in the shared layer.

### TDD Log

- Red: extended `frontend/tests/ui/primitives/typography.test.ts` and added `frontend/tests/components/amount.test.tsx` against the existing primitive output.
- Green: extracted shared semantic text recipes into `frontend/src/ui/tokens/textRecipes.ts`, then updated the primitive recipes and component wrappers to consume them.
- Verify: `npm --prefix frontend test -- tests/ui/primitives/typography.test.ts`, `npm --prefix frontend test -- tests/components/amount.test.tsx`, `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:drift`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend test`.

## Phase 3: Shared App Components And Major Surfaces

Migrate repeated hard-coded text colors in major user-visible surfaces:

- Auth and onboarding
- Dashboard and analytics cards
- Accounts and balances
- Budgets
- Transactions
- Settings
- Header, footer, toasts, and modals

Implementation details:

- Prioritize production source files before Storybook-only slices.
- Keep finance, category, chart, and provider-specific colors on their existing domain palettes instead of forcing them into generic text roles.

Acceptance criteria:

- Major production screens use semantic text recipes for primary, body, muted, label, inverse, and state copy.
- Remaining hard-coded text classes in production files are either domain-specific palette usage or documented local exceptions in the implementation summary.
- Current visual tone is preserved across `http://localhost:3001/` in light and dark mode.
- `typecheck` and relevant Jest tests pass.
- Storybook stories still compile after component API stability is confirmed.

Completed:

- Updated the main app shell, session expiry modal, auth screens, footer, password checklist, toast, error boundary, and disconnect modal to consume semantic text roles.
- Preserved domain-specific palette text for finance, category, and chart surfaces that intentionally encode meaning beyond the shared copy hierarchy.
- Added focused component coverage for shared shell copy, password checklist text, session expiry text, footer copy, and toast text.

### TDD Log

- Red: added `frontend/tests/components/shell-text.test.tsx` to cover shared shell copy surfaces and confirmed the new assertions failed against the previous hard-coded slate text classes.
- Green: replaced the shared production text classes in `frontend/src/App.tsx`, `frontend/src/SessionManager.tsx`, `frontend/src/Auth.tsx`, `frontend/src/components/Footer.tsx`, `frontend/src/components/PasswordChecker.tsx`, `frontend/src/components/ErrorBoundary.tsx`, `frontend/src/components/Toast.tsx`, and `frontend/src/components/DisconnectModal.tsx`.
- Verify: `npm --prefix frontend test -- tests/components/shell-text.test.tsx tests/ui/primitives/typography.test.ts tests/components/amount.test.tsx`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run design:guard`.

## Phase 4: Guardrails And Cleanup

Add a text-color audit to flag new ad hoc `text-slate-*`, broad `dark:text-*`, and raw state text classes outside approved token or recipe files.

Implementation details:

- Integrate the audit into `npm --prefix frontend run design:guard` after migration is complete.
- Update primitive docs and examples to use semantic text recipes rather than hard-coded slate classes.

Acceptance criteria:

- `design:guard` fails on newly introduced common ad hoc text color classes outside approved locations.
- Approved exceptions are narrow and limited to generated artifacts, token recipes, chart/category/finance palettes, and intentional local visual exceptions.
- Primitive docs no longer teach hard-coded slate text colors for common copy.
- Full frontend validation path passes: `design:guard`, focused token tests, `typecheck`, and relevant Jest tests.

Completed:

- Added `frontend/scripts/check-text-color-styling.mjs` and wired it into `design:guard`.
- Updated remaining common-copy production surfaces, including dashboard, transactions, settings, footer, status pills, chart cards, and top merchants, to use semantic text roles.
- Updated primitive docs and Storybook examples to use semantic text roles instead of hard-coded slate copy.
- Kept chart, finance, onboarding, and provider-specific color palettes as documented local exceptions.

### TDD Log

- Red: added `frontend/tests/scripts/text-color-audit.test.ts` against a temporary source tree and confirmed it failed before the audit script existed.
- Green: implemented `frontend/scripts/check-text-color-styling.mjs`, cleaned the remaining common-copy surfaces, and updated the docs/examples.
- Verify: `npm --prefix frontend test -- tests/scripts/text-color-audit.test.ts tests/ui/tokens/text.test.ts tests/ui/primitives/typography.test.ts tests/components/amount.test.tsx tests/components/shell-text.test.tsx`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run lint`.

## Local Exceptions

Keep these local or palette-specific rather than global text roles:

- Chart axis and tooltip text, because chart tokens already exist.
- Category pill text and dots, because category accents are generated by category role.
- Finance and account-type colors, because cash, investments, credit, loan, and net worth already have semantic palettes.
- Provider-specific or onboarding brand accent chips when they intentionally represent Plaid, Teller, or marketing artwork.
- Rare animated or gradient-overlay text where tokenizing would reduce clarity.

## Assumptions

- Preserve appearance by mapping semantic roles to current Tailwind-equivalent values rather than choosing a new palette.
- Do not add packages.
- Do not read or write `.env` files.
- Do not add source comments.
- Keep generated token artifacts updated through the existing design token scripts, not by hand-editing generated files.

## Risks

- Broad text-role migration can accidentally flatten intentional visual hierarchy if primary, body, muted, and label roles are mapped too coarsely.
- Guardrails may initially flag intentional domain palettes; the audit allowlist must distinguish common copy colors from chart, category, finance, and provider palettes.
- Generated artifacts can drift if `DESIGN.md` changes are not followed by the existing export pipeline.

## Next Actions

1. Implement token foundation and tests.
2. Migrate primitives and central recipes.
3. Migrate production app surfaces by feature area.
4. Add guardrails and update docs after the migration is complete.
