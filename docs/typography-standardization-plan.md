# Typography Standardization Plan

## Summary

Standardize Sumurai typography around a condensed semantic scale, then migrate shared primitives and high-impact screens to use it. The implementation should make `1rem / 16px` the app's normal readable text size, keep `0.875rem / 14px` as the common minimum, and reduce one-off font-size, line-height, and tracking choices.

## Typography Standard

- Sizes: fluid display, `2rem`, `1.5rem`, `1.25rem`, `1rem`, `0.875rem`, `0.75rem`.
- Line heights: `1.1`, `1.25`, `1.5`, and compact uppercase `1`.
- Tracking: only `0` and `0.14em`; nonzero tracking is reserved for uppercase labels, badges, and pills.
- `body` is the app default; `caption` is the normal minimum UI size.

## Available Validation Tools

- Google `design.md` CLI:
  - `designmd lint DESIGN.md`
  - `designmd export --format dtcg DESIGN.md`
  - `designmd export --format css-tailwind DESIGN.md`
  - `designmd diff DESIGN.md DESIGN-v2.md`
  - `designmd spec --rules`
- Repo wrappers:
  - `npm --prefix frontend run design:lint`
  - `npm --prefix frontend run design:export:dtcg`
  - `npm --prefix frontend run design:export:tailwind`
  - `npm --prefix frontend run design:guard`
- Frontend validation:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run storybook`
  - `npm --prefix frontend run test:storybook-runtime`
- Visual validation:
  - Use Storybook and/or the local frontend app at 100% browser zoom.
  - Inspect desktop and narrow mobile viewports for clipping, overlap, and overflow.

## Test Update Strategy

- Update token tests when typography roles or exported token contracts change.
- Update primitive tests or stories when shared component typography changes, especially `PageLayout`, `Button`, `Badge`, `FormLabel`, `Alert`, and `EmptyState`.
- Update feature/component stories for visual states most likely to expose readability or overflow issues: long labels, dense rows, empty states, loading states, compact badges, tables, and mobile-width layouts.
- Prefer Storybook coverage for visual hierarchy and layout behavior; prefer Jest/frontend tests for exported token contracts and component API behavior.
- Do not add tests inline with source code.
- Avoid broad snapshot churn; update targeted stories/tests that prove the new hierarchy renders and remains stable.

## Implementation Plan

### 1. Codify Typography Tokens

Goal: make `DESIGN.md` the canonical source for the condensed typography standard and regenerate token artifacts from it.

- Update the `typography:` section in `DESIGN.md` with:
  - `display`: `clamp(2.25rem, 3vw, 3rem)`, `700`, `1.1`, `0`, `Cal Sans`
  - `page-title`: `2rem`, `700`, `1.1`, `0`, `Cal Sans`
  - `section-title`: `1.5rem`, `600`, `1.25`, `0`, `Mr Eaves XL Mod`
  - `card-title`: `1.25rem`, `600`, `1.25`, `0`, `Mr Eaves XL Mod`
  - `body`: `1rem`, `400`, `1.5`, `0`, `Mr Eaves XL Mod`
  - `body-strong`: `1rem`, `600`, `1.5`, `0`, `Mr Eaves XL Mod`
  - `caption`: `0.875rem`, `400`, `1.5`, `0`, `Mr Eaves XL Mod`
  - `caption-strong`: `0.875rem`, `600`, `1.5`, `0`, `Mr Eaves XL Mod`
  - `label`: `0.75rem`, `600`, `1`, `0.14em`, `Mr Eaves XL Mod`
  - `badge`: `0.75rem`, `700`, `1`, `0.14em`, `Mr Eaves XL Mod`
- Keep compatibility aliases during migration:
  - `brand` remains the app logo role.
  - `sans` maps to `body`.
  - `subheading` maps to `body-strong`.
  - `pill` maps to `badge`.
  - `budget-progress-caption` maps to `caption`.
  - `budget-progress-caption-strong` maps to `caption-strong`.
- Add a short Typography rationale in the Markdown body of `DESIGN.md`.
- Regenerate:
  - `frontend/src/ui/tokens/generated/tokens.dtcg.json`
  - `frontend/src/ui/tokens/generated/tokens.ts`
  - `frontend/src/ui/tokens/generated/theme.css`

Acceptance criteria:

- `DESIGN.md` contains the full role table in machine-readable front matter.
- `designmd lint DESIGN.md` passes, or any CLI schema limitation is documented and the repo wrapper still passes.
- `designmd export --format dtcg DESIGN.md` and `designmd export --format css-tailwind DESIGN.md` produce the expected new roles.
- Generated token artifacts expose every new typography role.
- Existing token consumers still compile because compatibility aliases remain available.

Status: completed.

Notes:

- `designmd` does not accept `clamp(...)` for typography dimensions, so the `display` token is exported as a fixed `3rem` value in the machine-readable contract.
- If a clamped `display` size is still desired in the app, keep that behavior in the consuming runtime recipe rather than in `DESIGN.md` or the generated token artifacts.

TDD log:

- Red: `npm --prefix frontend test -- tests/ui/tokens/typography.test.ts`
- Green: `npm --prefix frontend run design:generate`
- Verify: `npm --prefix frontend run design:lint`, `npm --prefix frontend run design:export:dtcg`, `npm --prefix frontend run design:export:tailwind`, `npm --prefix frontend run design:guard`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test`

### 2. Expose App Typography Recipes

Goal: make typography easy to consume consistently through `designTokens.typography`.

- Update `frontend/src/ui/tokens/index.ts` so `designTokens.typography` exposes class recipes:
  - `display`, `pageTitle`, `sectionTitle`, `cardTitle`
  - `body`, `bodyStrong`, `caption`, `captionStrong`
  - `label`, `badge`
- Each recipe includes size, weight, line-height, tracking, and font family when needed.
- Preserve `brand` and `sans` font-family access if still consumed.
- Add or update token tests under `frontend/tests/` to verify:
  - Every semantic role exists.
  - `body` uses `1rem`.
  - `caption` uses `0.875rem`.
  - `label` and `badge` share `0.14em` tracking.
  - No typography recipe uses a size below `0.75rem`.

Acceptance criteria:

- TypeScript can import every semantic role from `designTokens.typography`.
- Existing `brand` and `sans` consumers still work or are migrated.
- Focused token tests pass.
- `npm --prefix frontend run typecheck` passes.

Status: completed.

Notes:

- `designTokens.typography` now exposes semantic class recipes for the app-facing roles while keeping `brand` and `sans` as font-family strings for existing consumers.
- The clamped `display` behavior lives in the runtime recipe layer so the design contract remains valid and generated artifacts stay stable.

TDD log:

- Verify: `npm --prefix frontend test -- tests/ui/tokens/typography.test.ts`, `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test`

### 3. Migrate Shared Primitives

Goal: push the new hierarchy into the reusable UI layer before touching feature screens.

- Update shared primitive recipes/components:
  - `PageLayout`: `badge`, `pageTitle`, `body`, `captionStrong`
  - `Button`: `label` for true compact `xs`, `captionStrong` for `sm/md`, `bodyStrong` for `lg`
  - `FormLabel`: `label`
  - `Badge`: `badge`; size variants should mainly change padding/radius
  - `Alert`: `captionStrong` title and `caption` or `body` body
  - `EmptyState`: `cardTitle` title and `body` description
  - Shared pill recipes: `badge`
- Remove primitive-level one-off text classes where a semantic role exists.

Acceptance criteria:

- Shared primitives no longer hard-code arbitrary typography values except through recipes.
- `PageLayout` titles and subtitles read larger at 100% viewport.
- Buttons remain stable and do not overflow with existing labels.
- Primitive stories render without text clipping.
- Affected primitive tests and `typecheck` pass.

Status: completed.

Notes:

- Shared typography now comes from the primitive recipe contract and is reused by the global token map and the primitive components.
- `PageLayout`, `Button`, `Badge`, `FormLabel`, `Alert`, `EmptyState`, `RequirementPill`, and the shared connect button wrapper now rely on semantic typography recipes instead of ad hoc text utilities.

TDD log:

- Red: `npm --prefix frontend test -- tests/ui/primitives/typography.test.ts`
- Green: updated primitive recipes and components to use semantic typography mappings
- Verify: `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test -- tests/ui/primitives/typography.test.ts`, `npm --prefix frontend test`, `npm --prefix frontend run design:guard`

### 4. Migrate High-Impact App Surfaces

Goal: apply the standard to the screens users see most often and remove the practical `text-sm` default from app content.

- Migrate:
  - Dashboard page and analytics cards/lists
  - Hero stat cards
  - Balances overview
  - Budgets page, list, summary, toolbar, and progress captions
  - Transactions page, toolbar, and table
  - Settings page
  - Onboarding screens
- Use:
  - `pageTitle` for page titles
  - `sectionTitle` for major sections
  - `cardTitle` for cards and panels
  - `body` for default copy
  - `bodyStrong` for row names, totals, and important values
  - `caption` for metadata, helper text, loading text, and secondary text
  - `captionStrong` for compact emphasized metadata
  - `label` or `badge` for pills, chips, table headers, labels, and overlines
- Keep below-caption sizes only for rare constrained cases such as chart internals.

Acceptance criteria:

- Main screens no longer use `text-sm` as default body copy.
- Search for `text-[10px]`, `text-[11px]`, `text-xs`, and `text-sm` returns only intentional exceptions or story/example code.
- Tables, cards, and stat areas do not clip text.
- Dashboard, budgets, transactions, settings, and onboarding are visibly more readable at 100% zoom.
- Affected frontend tests and `typecheck` pass.

Status: completed.

Notes:

- Dashboard, balances, budgets, transactions, settings, and onboarding now consume the shared semantic typography recipes instead of ad hoc size utilities.
- Shared app shell components such as the title bar, error boundary, toast, provider mismatch modal, session modal, and footer also use the semantic scale.
- Remaining raw size hits are limited to story slices, the shared button-size contract, and the generated token artifact.

TDD log:

- Red: `rg -n "text-(xs|sm)|text-\\[10px\\]|text-\\[11px\\]" frontend/src --glob '!**/*.stories.tsx' --glob '!**/README.md'`
- Green: migrated the app surfaces and shared shell components to semantic typography recipes
- Verify: `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run design:guard`, `npm --prefix frontend test`

### 5. Visual QA And Cleanup

Goal: confirm the new hierarchy works in real app contexts and document remaining intentional exceptions.

- Inspect in Storybook or the frontend app:
  - Dashboard populated state
  - Budgets populated and empty states
  - Transactions populated and loading states
  - Settings page
  - Onboarding welcome and connect-account screens
- Check desktop and narrow mobile viewports.
- Look for clipping, overlap, oversized headings in dense UI, caption bloat in chart areas, inconsistent tracking, and horizontal overflow.
- Keep any below-`0.875rem` exceptions localized and rare.

Acceptance criteria:

- No obvious text overlap, clipping, or horizontal page overflow appears in inspected screens.
- Remaining below-caption typography is intentional and localized.
- Final search confirms most app typography uses semantic recipes.
- Final validation passes:
  - `npm --prefix frontend run design:guard`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run test:storybook-runtime` if stories changed
- Final implementation summary lists intentional typography exceptions.

Status: completed.

Notes:

- Dashboard, budgets, transactions, settings, login, register, and onboarding welcome/connect screens were checked at desktop and narrow mobile widths in the live app.
- The onboarding wizard was reached through a throwaway local account to verify the denser connection screen layout.
- Storybook was unavailable on the default local port in this session, so the app itself was used for the visual verification pass.

TDD log:

- Verify: `npm --prefix frontend run design:guard`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test`

## Assumptions

- No package additions are needed.
- Keep `Cal Sans` for display/brand and `Mr Eaves XL Mod` for UI/body.
- Generated token files may be updated.
- Do not read or write `.env` files.
- Do not add source code comments.

## Risks

- Larger default text may create overflow in dense table rows, pills, and compact card layouts.
- Some generated token output may be constrained by the Google `design.md` CLI schema; document any limitation if the repo wrapper still passes.
- The app currently mixes token recipes and direct Tailwind utilities, so migration should proceed from shared primitives outward to avoid repeated local fixes.

## Next Actions

1. Implement the token contract in `DESIGN.md`.
2. Regenerate token artifacts.
3. Add focused token tests for the new typography recipes.
4. Migrate shared primitives.
5. Migrate high-impact screens and complete visual QA.
