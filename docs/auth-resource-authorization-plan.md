# Resource-Bound Authorization Middleware

## Summary
Keep JWT validation in the existing auth middleware, then add a separate resource-aware authorization boundary that runs per route shape. The guard should validate tenant ownership before the handler executes and should pass only authorized IDs or payloads forward. Handlers should remain thin and only act on already-authorized data.

## Phase 1: Define the authorization boundary
- Keep `backend/src/auth_middleware.rs` as authentication only: bearer token parsing, JWT validation, session validation, and `AuthContext` attachment.
- Define a resource authorization contract that accepts one resource shape at a time:
  - path IDs such as budget IDs
  - query filters such as `account_ids`
  - body IDs such as `connection_id`
- Reuse `backend/src/services/authorization_service.rs` and repository-scoped lookups for tenant checks.
- Decide the response mapping up front:
  - malformed IDs -> `400`
  - foreign single-resource IDs -> `404`
  - foreign multi-ID filters -> `403`

## Phase 2: Implement route-bound guards
- Add a small middleware or extractor layer under `backend/src/middleware/` for resource authorization.
- Make the guard route-specific, not global. Each route should declare the resource it protects and the guard should validate that shape before the handler runs.
- Compose protected routes as:
  - auth middleware
  - resource authorization guard
  - handler
- Keep handlers focused on business logic only. They should receive validated IDs or already-authorized request data.
- Update the affected endpoints in `backend/src/main.rs`:
  - budgets update/delete
  - provider sync/disconnect
  - analytics and transaction routes that accept `account_ids`

## Phase 3: Tighten repository and service contracts
- Keep repository methods user-scoped where possible so authorization checks and data access use the same tenancy rule.
- Add or keep ownership-aware repository methods for budgets and provider connections.
- Preserve the existing service layer as the place where business logic runs after authorization has already succeeded.

## Phase 4: Test the enforcement boundary
- Add boundary tests for each resource shape:
  - owned path ID passes
  - foreign path ID returns `404`
  - owned `account_ids` passes
  - foreign `account_ids` returns `403`
  - owned `connection_id` passes
  - malformed IDs return `400`
- Add integration tests that verify handlers do not need to perform their own ownership checks once the guard has accepted the request.
- Keep tests in `backend/src/tests/` and use existing mock repository patterns.

## Assumptions
- The auth middleware remains identity-only and does not become a generic parser for every request shape.
- The authorization layer is small and explicit rather than one catch-all middleware for the whole API.
- The current tenancy policy remains owner-only for these endpoints.

## Risks
- A generic middleware that tries to parse every request shape would be brittle and hard to maintain.
- Query-filter endpoints need route-specific handling because they do not map cleanly to a single path parameter.
- If a handler still performs its own ownership checks, the enforcement path becomes harder to reason about and may drift over time.

## Implementation Notes
- Implemented the guard as route-bound extractors instead of one catch-all middleware.
- JWT auth still lives in `backend/src/auth_middleware.rs`; resource ownership now runs before handlers for budgets, provider connections, and account-filtered analytics routes.
- Handlers now consume already-authorized IDs or payloads and no longer perform inline ownership checks.

## TDD Log
- Added coverage for owned and foreign account filters, invalid account IDs, budget ownership, and invalid connection payloads.
- Verified with `cargo test` in `backend/`; final run passed 179 tests.
