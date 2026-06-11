# Testing Rules

Use these rules when designing Sumurai tests.

## Boundary Focus

- Test public behavior through service, hook, component, API, or domain boundaries.
- Avoid tests that assert private helper steps unless the helper is itself a public domain utility.
- Prefer one clear behavioral assertion path over broad internal snapshots.
- Keep unit tests deterministic and independent of real network, browser storage, time, and database state unless the test is explicitly integration-level.

## Frontend

- Use existing React Testing Library and Bun test patterns under `frontend/tests/` (`mock.module`, `mock()` from `bun:test`).
- Use existing test providers and setup helpers.
- Test user-visible behavior, API client contracts, hook state transitions, and domain transformations.
- Keep snapshots limited to stable primitive output where the repo already uses them.
- Add token tests when changing shared design-token semantics.
- For rendered UI in a real browser (interactions, a11y-relevant rendering paths, story-driven states), extend or add Storybook stories and cover them with the Storybook Vitest project rather than duplicating the same scenarios only in Bun test when the browser project already owns that boundary.
- Treat `bun --cwd=frontend run test:storybook-runtime` as a smoke gate on the static Storybook artifact; add or adjust those tests only when the failure mode is load-level or routing of the Storybook build, not for per-component assertions.

## Storybook

- Prefer stories and the Vitest Storybook project for component-level browser behavior; follow existing `*.stories.tsx` patterns and Storybook addon-vitest tagging conventions in this repo.
- Run `bun --cwd=frontend run test:storybook` after changing stories or primitives that participate in browser tests.
- Run `bun --cwd=frontend run test:storybook-runtime` when touching Storybook config, static build output, or Playwright smoke expectations.

## Backend

- Test services with controlled repository/provider/cache boundaries.
- Test handlers and middleware through request/response behavior.
- Test auth, provider sync, budgets, cache behavior, and security edge cases when touched.
- Keep fixtures explicit and avoid relying on test order.
- Use migrations tests for schema behavior and forward compatibility checks.

## Validation Strategy

- Run the narrowest relevant test first.
- Run all frontend tests when shared frontend test utilities, primitives, or tokens change.
- Run Storybook Vitest when stories, primitives, or Storybook test config change in ways that affect browser-rendered behavior.
- Run Storybook build and runtime smoke when Storybook or Playwright storybook config changes, or when verifying CI parity for the static Storybook job.
- Run all backend tests when shared services, auth, middleware, providers, migrations, or models change.
- Run typecheck/build commands when TypeScript or Rust public interfaces change.
