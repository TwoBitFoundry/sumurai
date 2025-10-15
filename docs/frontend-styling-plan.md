# Frontend Styling Remediation Plan

## Objective
Improve the maintainability of the styling layer by extracting reusable primitives, consolidating theme management, and reducing coupling between presentation and feature logic. This plan organises the work into sequential workstreams ready for future implementation.

## Workstream A – Introduce Styling Primitives
- **Goal:** Replace long inline Tailwind strings with reusable building blocks.
- **Key Steps:**
  1. Catalogue repeated style patterns (buttons, cards, shell/gradient containers, tab buttons) across `AuthenticatedApp`, `Auth` screens, and shared UI.
  2. Create a `ui/primitives` directory housing utilities such as `GlassCard`, `GradientShell`, and `PrimaryButton`, implemented with Tailwind through `clsx`/`cva` for variant support.
  3. Migrate components to compose these primitives, removing duplicated class strings while preserving current visuals.
  4. Document the available primitives and variants inline to guide future contributions.
- **Considerations:** keep primitives un-opinionated; allow consumers to extend via className overrides for edge cases.

## Workstream B – Centralise Theme Management
- **Goal:** Single source of truth for light/dark selection and class toggling.
- **Key Steps:**
  1. Create a `ThemeProvider` that manages `dark` state, persists user preference, and exposes `useTheme()` hook (`mode`, `toggle`, `set`).
  2. Update `App`, `AuthenticatedApp`, onboarding flows, and the login/register screens to consume `useTheme()` instead of duplicating state and Tailwind class toggles.
  3. Move global theme class application to the provider (e.g., toggling `document.documentElement.classList`) so components no longer wrap themselves in conditional `div` wrappers.
  4. Ensure the provider handles system preference initialization and updates the existing `utils/theme` helpers or deprecates them in favour of the provider.
- **Considerations:** expose a testing helper to render components under a mocked theme context.

## Workstream C – Segment Layout from Feature Logic
- **Goal:** Keep components focused on data/interaction while styling resides in dedicated wrappers.
- **Key Steps:**
  1. For each major page (`DashboardPage`, `TransactionsPage`, `Auth` forms), move page-level layout into `layouts/` components (e.g., `DashboardLayout`, `AuthLayout`) that focus purely on markup and styling.
  2. Refactor feature components to accept render-props or children for slots (header actions, tab content) so logic stays in the page component while layout wraps around it.
  3. Extract the heavy background/gradient markup from `AuthenticatedApp` into a `BackgroundCanvas` primitive that is configured via props.
- **Considerations:** ensure layout components remain dumb and accept className overrides to stay flexible.

## Workstream D – Establish Styling Governance
- **Goal:** Prevent regressions by codifying guidelines and adding guardrails.
- **Key Steps:**
  1. Add linting rules or custom ESLint check to flag Tailwind strings longer than a threshold unless explicitly allowed.
  2. Extend storybook (if used) or create visual regression tests for key primitives, ensuring theme modes and hover states remain intact.
  3. Update contributor documentation with instructions on when to introduce new primitives versus inline classes.
  4. Provide sample usage snippets for the new primitives in `docs/` or within Storybook stories.

## Dependencies & Sequencing
1. Start with Workstream A to build the primitive foundation.
2. Execute Workstream B to propagate theme control through the new primitives.
3. Proceed with Workstream C to reorganise layouts using the primitives and theme provider.
4. Conclude with Workstream D to codify practices and prevent regression.

## Definition of Done
- Core screens rely on shared primitives instead of bespoke Tailwind strings.
- Theme state is provided via context and no component owns its own `dark` flag.
- Layout/background structures reside in dedicated components, leaving feature components mostly logic/data.
- Linting and documentation exist to guide future styling contributions.
