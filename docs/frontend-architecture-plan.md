# Frontend Architecture Remediation Plan

## Objective
Resolve the separation-of-concerns gaps identified in the frontend by introducing explicit dependency boundaries, centralising session management, and simplifying component responsibilities. The plan below is broken into workstreams that a future implementor can pick up without rediscovering prior context.

## Workstream A – Replace Static Singletons With Injected Clients
- **Goal:** Allow services and hooks to receive the HTTP transport, auth token source, and base URL via dependency injection instead of static singletons (`ApiClient`, `AuthService`).
- **Key Steps:**
  1. Design an `ApiEnvironment` interface (`get`, `post`, `put`, `delete`, `refreshToken`, `clearToken`) and an `AuthTokenProvider` abstraction covering `getToken`, `storeToken`, `clearToken`.
  2. Refactor `ApiClient` into an instantiable class or factory (`createApiClient(env: ApiEnvironment)`), removing hard-coded references to `AuthService`.
  3. Update service modules (`PlaidService`, `AnalyticsService`, `TransactionService`, `ProviderCatalog`, `TellerService`) to become thin wrappers around an injected client instance. Export a default instance wired up in a new `services/index.ts`, but ensure consumers can receive custom instances (e.g., via React context).
  4. Introduce a `ServicesProvider` React context that constructs the client, stores it, and exposes hooks (`useServices`, `useApiClient`) for feature code.
  5. Update hooks/components to resolve services via context rather than static imports; adjust tests to inject fakes.
- **Considerations:** preserve existing retry behavior; ensure token refresh path still guards against concurrent refreshes by moving the promise lock into the `AuthTokenProvider`.

## Workstream B – Centralise Session & JWT Handling
- **Goal:** Eliminate duplicated JWT parsing and storage access spread across `App`, `SessionManager`, and `AuthService`.
- **Key Steps:**
  1. Extend the `AuthTokenProvider` to encapsulate JWT decode/expiry logic (`isExpired`, `secondsUntilExpiry`).
  2. Build a `SessionController` module responsible for `validateSession`, `refreshSession`, `logout`, and session-change events; it should rely only on the abstractions from Workstream A.
  3. Create a `SessionProvider` (React context) exposing high-level actions (`login`, `logout`, `extendSession`, `state`) and subscribe `SessionManager`/`App` to that provider.
  4. Refactor `App` to consume `useSession()` for auth state checks and to remove direct `sessionStorage` access.
  5. Simplify `SessionManager` so it becomes a listener on session state (using `secondsUntilExpiry`) and dispatches provider actions rather than mutating storage.
- **Considerations:** maintain onboarding flag handling by moving it into the session state; ensure logout always clears both local and remote state via the unified controller.

## Workstream C – Decouple Modals From Business Logic
- **Goal:** Convert `SessionExpiryModal` into a presentational component and move token refresh/expiry handling into hooks/providers.
- **Key Steps:**
  1. Split the modal into `SessionExpiryModal` (pure presentational) and a `useSessionCountdown` hook that handles timers and actions.
  2. Have `SessionManager` use `useSessionCountdown` and pass callbacks from the session provider into the modal.
  3. Ensure modal props include only data (`isOpen`, `timeRemaining`) and handlers (`onExtend`, `onLogout`), with no direct calls to services.
- **Considerations:** expose analytics/events if needed for future UX tracking via optional callbacks rather than hard-coded console logs.

## Workstream D – Ensure Test Coverage & Migration Support
- **Goal:** Guard the refactor with automated coverage and a migration guide.
- **Key Steps:**
  1. Add unit tests for the new abstractions (`createApiClient`, `AuthTokenProvider`, `SessionController`).
  2. Backfill component tests ensuring `App` and `SessionManager` correctly respond to session state changes.
  3. Provide a temporary compatibility layer that re-exports the old static singletons for modules not yet migrated, with TODOs to remove once adoption completes.
  4. Document (in developer docs) how to inject alternate clients for storybook/tests.

## Dependencies & Sequencing
1. Execute Workstream A first to unlock dependency injection across the codebase.
2. Proceed with Workstream B immediately after, using the new abstractions.
3. Tackle Workstream C once session logic is centralised.
4. Finish with Workstream D to solidify coverage and ease onboarding.

## Definition of Done
- No component or hook imports static service singletons.
- All session/JWT logic flows through the new session provider.
- Modals contain no side-effecting code.
- Tests cover the critical scenarios and CI passes.
- Documentation describes how to extend or swap service clients.
