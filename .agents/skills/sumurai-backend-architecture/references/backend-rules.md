# Backend Rules

Use these rules when changing the Rust backend.

## Separation Of Concerns

- Handlers parse requests, call services, and format responses.
- Services own business behavior and orchestration.
- Models define data shape and serialization contracts.
- Providers isolate external bank provider details.
- Middleware handles cross-cutting request concerns.
- Utilities stay small and stateless.

## Data And Security

- Keep user ownership and resource authorization explicit.
- Preserve JWT, auth cookie, rate limit, IP ban, and resource authorization boundaries.
- Do not weaken Redis-backed cache/rate-limit assumptions.
- Do not log secrets, tokens, private keys, credentials, or raw sensitive financial data.
- Use `.env.example` for configuration reference; never read `.env` files.

## Database

- Add forward migrations under `backend/migration/src/` and register them in `Migrator::migrations()`.
- Regenerate entities in `backend/entity/` after schema changes (`sea-orm-cli generate entity`).
- Preserve existing migration compatibility with deployed data where possible.
- Add migration tests when schema behavior or compatibility matters.

## Providers

- Use provider traits and registry patterns for Plaid/Teller behavior.
- Keep provider-specific mapping outside generic services unless the mapping is a shared domain rule.
- Preserve cache and sync behavior when changing provider flows.

## Observability

- Preserve OpenTelemetry and structured tracing patterns.
- Keep telemetry sanitization and redaction intact.
- Add boundary-level logs for meaningful service failures, not noisy internal steps.
