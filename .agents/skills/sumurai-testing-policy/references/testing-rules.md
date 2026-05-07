# Testing Rules

Use these rules when designing Sumurai tests.

## Boundary Focus

- Test public behavior through service, hook, component, API, or domain boundaries.
- Avoid tests that assert private helper steps unless the helper is itself a public domain utility.
- Prefer one clear behavioral assertion path over broad internal snapshots.
- Keep unit tests deterministic and independent of real network, browser storage, time, and database state unless the test is explicitly integration-level.

## Frontend

- Use existing React Testing Library and Jest patterns.
- Use existing test providers and setup helpers.
- Test user-visible behavior, API client contracts, hook state transitions, and domain transformations.
- Keep snapshots limited to stable primitive output where the repo already uses them.
- Add token tests when changing shared design-token semantics.

## Backend

- Test services with controlled repository/provider/cache boundaries.
- Test handlers and middleware through request/response behavior.
- Test auth, provider sync, budgets, cache behavior, and security edge cases when touched.
- Keep fixtures explicit and avoid relying on test order.
- Use migrations tests for schema behavior and forward compatibility checks.

## Validation Strategy

- Run the narrowest relevant test first.
- Run all frontend tests when shared frontend test utilities, primitives, or tokens change.
- Run all backend tests when shared services, auth, middleware, providers, migrations, or models change.
- Run typecheck/build commands when TypeScript or Rust public interfaces change.
