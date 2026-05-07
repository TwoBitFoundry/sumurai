# Backend Map

Use this map to place backend changes in the right module.

## Core Areas

- `backend/src/main.rs`: Axum application wiring, routes, state, middleware, and service assembly.
- `backend/src/models`: API/domain data structures, app state, errors, query types, auth/account/budget/transaction models, and cache-related models.
- `backend/src/services`: business logic for auth, authorization, analytics, budgets, cache, connections, providers, repository access, sync, rate limiting, and telemetry relay.
- `backend/src/providers`: provider abstraction and Plaid/Teller provider implementations.
- `backend/src/middleware`: request middleware for auth, IP bans, resource authorization, and telemetry.
- `backend/src/handlers`: request handlers that are not embedded directly in main routing.
- `backend/src/openapi`: OpenAPI schemas, tags, and generated API documentation shape.
- `backend/src/utils`: focused helpers for auth cookies, cache keys, encryption key handling, and account validation.
- `backend/migrations`: SQL migrations.
- `backend/src/tests`: backend tests and fixtures.

## Placement Rules

- New request/response DTOs and shared data models go in `backend/src/models`.
- New business decisions go in `backend/src/services`.
- New provider-specific network logic goes in `backend/src/providers`.
- New request authorization checks belong in authorization services or middleware, depending on whether they are route-level or business-level.
- New schema changes require a migration and tests when behavior is observable.
- New API shapes should be reflected in `backend/src/openapi` when relevant.
