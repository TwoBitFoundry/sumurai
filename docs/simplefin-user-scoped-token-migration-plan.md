# SimpleFIN User-Scoped Token Flow With Institution-Aligned Disconnect Semantics

## Summary

Rework SimpleFIN to align with the existing provider model as closely as possible:
- one `provider_connection` per institution for all providers, including SimpleFIN
- many accounts under a connection
- disconnecting an institution removes that institution’s connection and child data
- when a provider has zero remaining connections, there must be no residual live provider credential

For SimpleFIN specifically:
- the user submits a one-time setup token
- backend claims and stores the returned access URL per user
- the stored access URL is an internal credential, not a user-visible “connected state”
- keep the existing SimpleFIN ignore-list mechanism as a required implementation detail
- partial disconnects add the institution to the ignore list so the bridge snapshot does not recreate it
- disconnecting the last remaining SimpleFIN institution also deletes the stored root credential and clears the ignore list, so the next setup requires a fresh token

Official references:
- [SimpleFIN Protocol](https://www.simplefin.org/protocol.html)
- [SimpleFIN Bridge Developer Guide](https://beta-bridge.simplefin.org/info/developers)

## Important Contract Changes

- Extend `ProviderConnectRequest` with a SimpleFIN-specific optional setup-token field.
- Remove frontend and backend product behavior that depends on deployment-scoped `SIMPLEFIN_SETUP_TOKEN`.
- Do not add a separate long-lived “bridge connected” frontend state.
- Keep institution disconnect on `/api/providers/disconnect`.
- Add backend logic so last-institution SimpleFIN disconnect escalates to full SimpleFIN credential cleanup automatically.
- Preserve and continue using `simplefin_hidden_orgs` as the authoritative persistence layer for ignored institutions.

## Phase 1: Audit and Preserve Existing SimpleFIN Foundations

### Goal

Ground the work in the current implementation so the migration reuses the existing SimpleFIN-specific pieces instead of replacing useful behavior.

### Tasks

- [x] Audit the current SimpleFIN implementation across credential resolution, connect flow, sync reconciliation, institution persistence, disconnect behavior, and hidden-org persistence.
- [x] Confirm the current roles of `simplefin_root_credentials`, `simplefin_hidden_orgs`, `SimpleFinConnectionService`, `SimpleFinOrganizationService`, and the current SimpleFIN test suite.
- [x] Treat ignore-list behavior as an implementation invariant to preserve, not a temporary workaround to remove.
- [x] Identify stale behavior to remove:
  - [x] shared `SIMPLEFIN_SETUP_TOKEN` assumptions
  - [x] startup gating based on that env var
  - [x] frontend and operator copy describing server-managed setup
- [x] Identify behavior to keep and adapt:
  - [x] hidden-org persistence
  - [x] ignored-institution restore flow
  - [x] multi-institution snapshot reconciliation
  - [x] org-level provider connections

### Acceptance Criteria

- [x] The implementation notes clearly distinguish which current SimpleFIN behavior must be preserved versus removed.
- [x] `simplefin_hidden_orgs` is explicitly retained as part of the final design.
- [x] The student agent has named implementation anchors to inspect before editing.
- [x] No part of the implementation plan replaces ignore-list behavior with frontend-only state.

### Implementation Notes

- Preserve `simplefin_hidden_orgs` as the authoritative ignore list and keep the restore flow that removes ignored orgs on demand.
- Preserve org-scoped provider connections and the multi-institution snapshot reconciliation path.
- Preserve `SimpleFinConnectionService`, `SimpleFinOrganizationService`, and the repository methods that persist hidden orgs and root credentials.
- Remove the shared setup-token assumptions in `Config`, `main.rs`, `SimpleFinCredentialResolver`, and frontend copy.
- Key anchors: `backend/src/services/simplefin_connection_service.rs`, `backend/src/services/simplefin_org_service.rs`, `backend/src/providers/simplefin_credential_resolver.rs`, `backend/src/config.rs`, `backend/src/main.rs`, `backend/src/services/repository_service.rs`, `frontend/src/utils/providerCapabilities.ts`, `frontend/src/utils/providerCards.ts`, `backend/src/tests/simplefin_*`.

### TDD Log

- Audit-only pass. No code changes were required for this step.
- Verification command(s): `cargo test --manifest-path backend/Cargo.toml simplefin -- --nocapture`
- Outcome: 41 SimpleFIN-focused backend tests passed. Current code preserves hidden-org persistence and org-level disconnect semantics, while shared setup-token assumptions remain in config, startup gating, credential resolution, and user-facing copy.

## Phase 2: Backend Connect Contract and Credential Ownership

### Goal

Move SimpleFIN connect to a user-submitted setup token model and make the stored access URL an internal per-user credential rather than a deployment-scoped input.

### Tasks

- [ ] Update `ProviderConnectRequest` to carry a dedicated SimpleFIN setup-token field.
- [ ] Refactor the SimpleFIN credential resolver so connect uses the request token instead of constructor-held env state.
- [ ] Preserve stored-credential reuse when a user already has at least one active SimpleFIN institution.
- [ ] Remove `SIMPLEFIN_SETUP_TOKEN` from `Config` as a connect-time dependency.
- [ ] Update provider startup so SimpleFIN registration does not require a shared setup token.
- [ ] Keep SimpleFIN availability gated by `DEFAULT_PROVIDER=simplefin`.
- [ ] Add explicit SimpleFIN error mapping for:
  - [ ] missing token when no SimpleFIN credential can be reused
  - [ ] malformed token
  - [ ] already-used or invalid token
  - [ ] claim failure
- [ ] Update OpenAPI schemas and examples for the connect request and documented error cases.

### Acceptance Criteria

- [ ] A fresh user can connect SimpleFIN only by submitting a setup token in the request.
- [ ] A user with existing active SimpleFIN institutions can reuse stored credentials without entering another token.
- [ ] Backend startup no longer requires `SIMPLEFIN_SETUP_TOKEN`.
- [ ] Token-related SimpleFIN connect failures return explicit non-500 API errors.
- [ ] OpenAPI reflects the new SimpleFIN connect contract.

## Phase 3: Institution-Aligned Disconnect Semantics With Persistent Ignore Lists

### Goal

Make SimpleFIN disconnect behavior align with Plaid and Teller at the institution connection level while preserving the ignore-list mechanism required by SimpleFIN’s full-snapshot payloads.

### Tasks

- [ ] Keep one `provider_connection` per SimpleFIN institution or org.
- [ ] Preserve existing per-institution disconnect behavior as the user-visible disconnect action for SimpleFIN.
- [ ] On partial SimpleFIN disconnect:
  - [ ] delete the institution connection
  - [ ] delete its accounts
  - [ ] delete its transactions
  - [ ] clear its cache entries
  - [ ] persist the institution or org in `simplefin_hidden_orgs`
  - [ ] keep the stored SimpleFIN access URL if other SimpleFIN institutions still remain
- [ ] Keep ignored institutions excluded from connect-time snapshot materialization, sync-time reconciliation, account persistence, and transaction persistence.
- [ ] Preserve the existing restore flow for ignored institutions so a user can opt an institution back in without a full reconnect.
- [ ] On last remaining SimpleFIN institution disconnect:
  - [ ] perform the normal institution disconnect cleanup
  - [ ] delete the stored SimpleFIN root credential
  - [ ] clear the SimpleFIN ignore list
- [ ] Ensure there is no durable “zero institutions but still connected underneath” state for SimpleFIN.

### Acceptance Criteria

- [ ] Disconnecting one of several SimpleFIN institutions removes only that institution’s data and keeps the remaining institutions usable.
- [ ] A partially disconnected SimpleFIN institution is persisted in `simplefin_hidden_orgs` and is not recreated on later sync.
- [ ] Restoring an ignored institution removes it from the ignore list and allows it to be re-materialized from the bridge snapshot.
- [ ] Disconnecting the last remaining SimpleFIN institution also deletes the stored SimpleFIN access URL and clears the ignore list.
- [ ] After the last SimpleFIN institution is disconnected, there is no residual SimpleFIN credential or ignored-org state left behind.

## Phase 4: Sync Reconciliation While Active Connections Exist

### Goal

Allow SimpleFIN to discover newly linked institutions through normal sync behavior while at least one SimpleFIN institution remains connected, using the ignore list as the durable opt-out control.

### Tasks

- [ ] Update SimpleFIN sync to reconcile the latest bridge snapshot before transaction sync.
- [ ] During reconciliation:
  - [ ] detect newly linked institutions from the bridge snapshot
  - [ ] create new `provider_connection` rows for newly visible orgs
  - [ ] attach and persist accounts under those institution connections
  - [ ] skip any org listed in `simplefin_hidden_orgs`
- [ ] Ensure connect-time materialization and sync-time reconciliation use the same hidden-org filtering rules.
- [ ] Only allow this discovery path while a valid stored SimpleFIN credential still exists.
- [ ] Because the last institution disconnect clears the root credential, do not support discovery after the user has fully disconnected all SimpleFIN institutions.
- [ ] Preserve existing transaction sync behavior and hidden-org protections.

### Acceptance Criteria

- [ ] A user with at least one active SimpleFIN institution can add another institution in SimpleFIN Bridge and discover it via normal sync.
- [ ] Newly discovered institutions are added automatically by default.
- [ ] Ignored institutions are not recreated during connect or sync reconciliation.
- [ ] Multi-institution SimpleFIN sync still works under one stored bridge credential.
- [ ] Once all SimpleFIN institutions are disconnected, sync can no longer rediscover institutions until the user reconnects with a new setup token.

## Phase 5: Frontend Onboarding and Accounts UX

### Goal

Update onboarding and accounts UI to reflect the new SimpleFIN token flow and the institution-aligned disconnect model without inventing a separate bridge-connected product state.

### Tasks

- [ ] Build a reusable SimpleFIN token-entry component or hook shared by onboarding and accounts.
- [ ] On onboarding, when the active or default provider is SimpleFIN:
  - [ ] render token entry
  - [ ] require non-empty input
  - [ ] submit through the updated SimpleFIN connect flow
  - [ ] show user-safe claim and validation errors
- [ ] On the accounts page for SimpleFIN:
  - [ ] if there are no SimpleFIN institution connections, show the token-entry connect UI
  - [ ] if there are SimpleFIN institution connections, keep the existing institution-based accounts experience
  - [ ] do not add a separate bridge-level disconnect action
- [ ] Keep per-institution disconnect actions in the connection list.
- [ ] Keep `Sync all` available so users with remaining SimpleFIN institutions can discover newly added institutions.
- [ ] Preserve the ignored-institutions UI and wire it to the existing restore capability.
- [ ] After the last SimpleFIN institution is disconnected, return the UI to the token-entry connect state.

### Acceptance Criteria

- [ ] Onboarding requires a pasted SimpleFIN token when SimpleFIN is the active provider.
- [ ] Accounts page shows token-entry connect UI when the user has zero SimpleFIN institution connections.
- [ ] Accounts page does not expose an extra bridge-level disconnect action separate from institution disconnects.
- [ ] Per-institution disconnect remains the only user-visible SimpleFIN disconnect affordance.
- [ ] The ignored-institutions restore UX remains available while other SimpleFIN institutions are still active.
- [ ] After the final SimpleFIN institution is disconnected, the UI returns to a clean reconnect-with-token state.

## Phase 6: Copy, Docs, and Test Coverage

### Goal

Remove the old shared-token narrative and lock in the new SimpleFIN semantics with focused documentation and tests.

### Tasks

- [ ] Replace all frontend SimpleFIN copy that says the token is configured by the server or operator.
- [ ] Update provider capability logic so SimpleFIN is no longer described as blocked by missing `SIMPLEFIN_SETUP_TOKEN`.
- [ ] Update architecture and SimpleFIN docs to describe:
  - [ ] one institution connection per provider connection
  - [ ] user-submitted setup token
  - [ ] stored per-user access URL
  - [ ] persistent ignored institutions via `simplefin_hidden_orgs`
  - [ ] partial disconnect writing to the ignore list
  - [ ] last institution disconnect clearing credentials and resetting SimpleFIN fully
  - [ ] sync discovery working only while at least one SimpleFIN institution remains connected
- [ ] Remove or rewrite stale config and UI tests tied to env-token behavior.
- [ ] Add or update backend tests for:
  - [ ] connect with request token
  - [ ] stored credential reuse
  - [ ] partial SimpleFIN disconnect
  - [ ] ignored-org persistence after disconnect
  - [ ] restore ignored institution
  - [ ] last-institution SimpleFIN disconnect deleting the root credential and clearing the ignore list
  - [ ] sync discovery of newly linked institutions
  - [ ] hidden-org filtering during connect and sync
- [ ] Add or update frontend tests for:
  - [ ] onboarding token entry
  - [ ] accounts page connect state with zero SimpleFIN institutions
  - [ ] institution disconnect behavior
  - [ ] ignored-institutions restore behavior
  - [ ] return to connect state after last disconnect
  - [ ] removal of env-token messaging

### Acceptance Criteria

- [ ] No user-facing copy says SimpleFIN is connected through a deployment-level setup token.
- [ ] Backend tests cover token claim, reuse, partial disconnect, ignore-list persistence, restore flow, last disconnect cleanup, and sync discovery.
- [ ] Frontend tests cover onboarding, zero-connection connect state, ignored-institution restore UX, and last-disconnect reset behavior.
- [ ] Docs describe the final SimpleFIN disconnect and ignore-list invariants accurately.
- [ ] The implementation can be handed to a student agent without unresolved product decisions.

## Assumptions

- SimpleFIN official docs are the source of truth.
- `DEFAULT_PROVIDER=simplefin` remains the deployment-level gate for exposing SimpleFIN.
- A SimpleFIN setup token is required only when the user has no reusable stored credential.
- SimpleFIN user-visible connections are institution-level only.
- `simplefin_hidden_orgs` is a permanent part of the design because SimpleFIN snapshots always include all currently linked institutions.
- Partial SimpleFIN disconnect must persist ignored institutions so they are not recreated by later snapshots.
- Disconnecting the last remaining SimpleFIN institution must fully clear SimpleFIN credentials and clear the ignore list.
- `Sync all` is the mechanism for discovering newly linked SimpleFIN institutions only while at least one SimpleFIN institution remains connected.

## Risks

- The current connect and sync code paths already contain SimpleFIN-specific branching; changing token ownership without keeping those paths consistent can reintroduce duplicate institutions or bypass hidden-org filtering.
- Last-institution disconnect cleanup touches credentials, cached state, provider connections, and ignored-org state; incomplete cleanup would leave SimpleFIN in a half-connected state that breaks the alignment goal.
- Frontend state currently assumes SimpleFIN can connect without local token entry in some paths; missing one of those surfaces would create inconsistent onboarding versus accounts behavior.
- OpenAPI and docs currently encode the old request contract and setup-token story; if they are not updated with the code, the next implementer will follow stale guidance.

## Next Actions

1. Start with Phase 1 and capture the exact code anchors the implementation will reuse.
2. Implement the backend request-contract and credential-lifecycle changes before touching the frontend.
3. Tighten disconnect semantics and hidden-org persistence together so the new invariant is testable early.
4. Finish with frontend UX, then docs and contract updates, then full targeted validation.
