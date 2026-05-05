# TBF-59 — Scope `synced_transactions` Redis key per session (`jti`)

**Linear:** [TBF-59](https://linear.app/twobitfoundry/issue/TBF-59/tm-002-scope-synced-transactions-redis-key-per-user) (TM-002)  
**Threat model:** `docs/sumurai-threat-model.md` (update mitigation text after implementation: scope is `**jti`**, not `user_id`)

## Problem

`synced_transactions` is a single global Redis key in `backend/src/services/cache_service.rs`. Any authenticated flow that calls `clear_transactions()` or writes via `add_transaction()` affects every tenant. Logout and sync must only affect the current session’s cache.

## Goal

Namespace the synced-transaction blob by `**jti**` (same value as `jwt_id` in `AuthContext` / `claims.jti`), matching existing JWT-scoped key conventions.

## Key design

- **Redis key:** `{jti}_synced_transactions` (prefix `jti` first so it matches `clear_jwt_scoped_data`, which uses `format!("{}*", jwt_id)`).
- **Implementation:** Add a suffix constant next to existing ones (e.g. `_session_token`, `_session_valid`) and `synced_transactions_key(jwt_id: &str) -> String`.

## API changes (`CacheService` / `RedisCache`)

- `add_transaction(&self, jwt_id: &str, transaction: &Transaction)`
- `clear_transactions(&self, jwt_id: &str)`

Read-modify-write and TTL (`TRANSACTIONS_TTL`) stay the same; only the key string changes.

## Call sites


| Area                                                      | `jwt_id` source                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `backend/src/services/connection_service.rs`              | `params.jwt_id` / `jwt_id` on paths that call `add_transaction` |
| `backend/src/main.rs` — `logout_user`                     | `claims.jti` (see logout note below)                            |
| `backend/src/main.rs` — `clear_authenticated_synced_data` | `auth_context.jwt_id`                                           |


Domain fields on `Transaction` (e.g. `user_id` for DB) are unchanged; cache isolation is by `**jti` only**.

## Logout behavior

`logout_user` already calls `clear_jwt_scoped_data(&claims.jti)`, which deletes **all** keys whose names start with that `jti`, so `{jti}_synced_transactions` is removed in that pass.

Optional: keep `clear_transactions(&claims.jti)` for an explicit, idempotent delete and clearer logs; or drop the redundant call if the team prefers a single mechanism.

## Tradeoffs

- **Token refresh** mints a new `jti`; synced-transaction cache does not carry over to the new token until the next sync (same as other `jti`-scoped Redis data).
- **Multiple tabs / tokens:** distinct `jti`s imply distinct cached blobs until TTL.

## Legacy key

After deploy, the old global key `synced_transactions` may remain until TTL or manual `DEL`. Document for ops if needed.

## Testing

- Update `cache_service_tests` for key shape and scoped behavior.
- Update `MockCacheService` expectations: `add_transaction` / `clear_transactions` include `jwt_id`.
- Update `auth_handlers_integration_tests` (logout) and `connection_service_tests` mocks for the new signatures.
- Re-check `sync_service_tests`; change only if they touch the cache trait.

## Out of scope (separate work)

- Invalidating the **previous** `jti` on refresh (session rotation hardening).
- Replacing `KEYS` with `SCAN` for large Redis instances.

## Assumptions

- Session identity for this cache is intentionally `**jti`**, not stable `user_id`, per product/security choice for this feature.
- `clear_jwt_scoped_data` remains part of logout.

## Risks

- Stale threat-model / ticket AC text still mentioning `user_id` could confuse reviewers; update Linear and `sumurai-threat-model.md` mitigation line after merge.
- Missed call site passing wrong `jwt_id` would scope cache incorrectly; rely on tests and always taking `jwt_id` from auth context, not request body.

## Phases (implementation tracking)

### Phase 1 — Cache, wiring, tests

- [x] Key helper `synced_transactions_key`, `CacheService` / `RedisCache` signatures with `jwt_id`.
- [x] `connection_service` Plaid + Teller paths pass `params.jwt_id` / `jwt_id`.
- [x] `logout_user` and `clear_authenticated_synced_data` pass `claims.jti` / `auth_context.jwt_id`.
- [x] `cache_service_tests`, `auth_handlers_integration_tests`, `connection_service_tests` updated.

### Phase 2 — Documentation alignment

- [x] `docs/sumurai-threat-model.md` TM-002 and related rows (jti-scoped key).
- [ ] Linear TBF-59 acceptance criteria: **`{jti}_synced_transactions`** (manual).

### Phase 3 — Optional ops

- [ ] One-time `DEL synced_transactions` post-deploy if cleaning legacy global key (manual).

## TDD log — Phase 1

- `cd backend && cargo test` — 211 passed.
- `cd backend && cargo clippy --all-targets -- -D warnings` — clean.

## Next actions (historical)

1. ~~Implement key helper + trait and `RedisCache` methods.~~
2. ~~Thread `jwt_id` through `connection_service` and `main.rs` handlers.~~
3. ~~Adjust tests and mocks.~~
4. ~~Update TM-002 wording in `docs/sumurai-threat-model.md` and Linear acceptance criteria to `{jti}_synced_transactions`.~~ (Linear still manual.)
5. Optional ops note: one-time `DEL synced_transactions` post-deploy.

## Definition of done

- No global `synced_transactions` key in use for reads/writes/deletes.
- One session cannot wipe another session’s synced-transaction cache via this mechanism.
- Tests green; documentation and ticket aligned with `jti` scoping.

