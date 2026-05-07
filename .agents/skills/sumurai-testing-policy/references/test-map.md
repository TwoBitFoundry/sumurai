# Test Map

Use this map to place tests in the correct area.

## Backend

- Backend tests live under `backend/src/tests/`.
- Backend fixtures live in `backend/src/tests/test_fixtures.rs`.
- Backend test modules are registered through `backend/src/tests/mod.rs`.
- Backend migrations live in `backend/migrations/` and migration tests live under `backend/src/tests/`.
- Run backend tests with `cargo test --manifest-path backend/Cargo.toml`.

Common backend areas:

- `backend/src/services`: business logic tests belong near service test modules.
- `backend/src/models`: model behavior tests belong in model test modules.
- `backend/src/providers`: provider behavior should be tested through provider boundaries.
- `backend/src/middleware`: middleware tests belong in middleware-specific test modules.
- `backend/src/handlers` and `backend/src/main.rs`: API and integration behavior belongs in integration test modules.

## Frontend

- Frontend tests live under `frontend/tests/`.
- Service tests live in `frontend/tests/services/`.
- Domain tests live in `frontend/tests/domain/`.
- Hook tests live in `frontend/tests/hooks/`.
- Component tests live in `frontend/tests/components/`.
- Primitive tests live in `frontend/tests/ui/primitives/`.
- Token tests live in `frontend/tests/ui/tokens/`.
- Integration tests live in `frontend/tests/integration/`.
- Shared test setup lives in `frontend/tests/setup/` and `frontend/tests/setup.ts`.

## Placement Rules

- Match the test folder to the public boundary under test.
- Add a new test file only when no existing file owns that boundary.
- Keep source folders free of test-only code.
- Reuse existing mocks in `frontend/tests/mocks/` and setup helpers before adding new ones.
