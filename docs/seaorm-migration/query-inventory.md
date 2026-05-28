# SQLx Query Inventory

> **Source of truth for Phase 5 completion.** Tick the `Status` checkbox for each row as the SeaORM implementation lands. Every row must be checked before Phase 5 acceptance criteria are considered met.

---

## Domain Summary

| Domain | Method count | Primary tables |
|--------|-------------|----------------|
| Users | 7 | `users` |
| Transactions | 17 | `transactions`, `accounts`, `transaction_category_overrides` |
| Accounts | 3 | `accounts`, `provider_connections` |
| Budgets | 5 | `budgets` |
| Custom categories | 3 | `user_custom_categories` |
| Category overrides | 2 | `transaction_category_overrides`, `user_custom_categories` |
| Provider connections | 6 | `provider_connections`, `accounts`, `transactions` |
| Provider credentials (encrypted) | 3 | `provider_credentials` |
| SimpleFin | 8 | `simplefin_root_credentials`, `simplefin_hidden_orgs`, `provider_connections`, `accounts`, `transactions` |
| **Total** | **54** | |

> The count of 54 rows reflects individual SQLx call sites (some methods contain more than one query).

---

## Users

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `create_user` | repository_service.rs:470 | insert | `users` | none | no | INSERT with explicit timestamps | [ ] |
| `get_user_by_email` | repository_service.rs:490 | select_one | `users` | none | no | `query_as` into 7-tuple, mapped via `map_user_row` | [ ] |
| `get_user_by_id` | repository_service.rs:512 | select_one | `users` | none | no | Same 7-tuple pattern as `get_user_by_email` | [ ] |
| `mark_onboarding_complete` | repository_service.rs:534 | update | `users` | none | no | Sets `onboarding_completed = true`, `updated_at = NOW()` | [ ] |
| `update_user_provider` | repository_service.rs:549 | update | `users` | none | no | Sets `provider`, `updated_at = NOW()` | [ ] |
| `update_user_password` | repository_service.rs:1945 | update | `users` | tenant-scoped | yes | `set_config` + UPDATE password_hash | [ ] |
| `delete_user` | repository_service.rs:1963 | delete | `users` | tenant-scoped | yes | `set_config` + DELETE — cascades via FK constraints | [ ] |

**Domain total: 7 methods, 9 SQLx call sites**

---

## Transactions

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `get_transactions_for_user` | repository_service.rs:1071 | select_many | `transactions` | tenant-scoped | yes | `query_as` into 13-tuple; LIMIT 1000; ordered by date DESC | [ ] |
| `get_spending_transactions_for_user` | repository_service.rs:1150 | select_many | `transactions` | tenant-scoped | yes | `QueryBuilder` with `append_category_exclusion` to exclude INCOME/LOAN/TRANSFER categories | [ ] |
| `get_transactions_with_account_for_user` | repository_service.rs:1223 | select_many | `transactions`, `accounts`, `transaction_category_overrides` | tenant-scoped | yes | JOIN accounts + LEFT JOIN overrides; COALESCE override category; maps to `TransactionWithAccountRow`; `is_overridden`/`is_custom` derived columns | [ ] |
| `get_transactions_by_date_range_for_user` | repository_service.rs:1485 | select_many | `transactions` | tenant-scoped | yes | WHERE date between start/end; LIMIT 1000 | [ ] |
| `get_spending_transactions_by_date_range_for_user` | repository_service.rs:1571 | select_many | `transactions` | tenant-scoped | yes | `QueryBuilder` with date range + category exclusion | [ ] |
| `get_provider_transaction_ids_for_user` | repository_service.rs:1653 | select_many | `transactions` | tenant-scoped | yes | `query_scalar` for DISTINCT `provider_transaction_id` | [ ] |
| `get_transaction_count_by_account_for_user` | repository_service.rs:1743 | select_many | `accounts`, `transactions` | tenant-scoped | yes | LEFT JOIN transactions; GROUP BY account.id; returns HashMap | [ ] |
| `upsert_transaction` | repository_service.rs:602 | upsert | `transactions` | tenant-scoped | yes | ON CONFLICT (account_id, provider_transaction_id) DO UPDATE amount/merchant_name/pending | [ ] |
| `upsert_transactions_batch` | repository_service.rs:647 | upsert | `transactions` | tenant-scoped | yes | `QueryBuilder::push_values` bulk INSERT ON CONFLICT; same conflict target as single upsert | [ ] |
| `get_transactions_paginated` | repository_service.rs:1260 | select_many | `transactions`, `accounts`, `transaction_category_overrides` | tenant-scoped | yes | Dynamic WHERE via `append_transaction_filters`; supports search, account_ids, date range, category; LIMIT+OFFSET; maps `TransactionWithAccountRow` | [ ] |
| `count_transactions` | repository_service.rs:1317 | select_one | `transactions`, `accounts`, `transaction_category_overrides` | tenant-scoped | yes | COUNT(*) with same dynamic filters as `get_transactions_paginated` | [ ] |
| `get_transactions_insights` | repository_service.rs:1355 | select_one | `transactions`, `accounts`, `transaction_category_overrides` | tenant-scoped | yes | Complex CTE: aggregates, largest, recurring merchants, top categories; returns `TransactionsInsightsResponse`; escape-hatch candidate (SeaORM DSL cannot express this CTE) | [ ] |
| `get_distinct_transaction_categories` | repository_service.rs:1460 | select_many | `transactions` | tenant-scoped | yes | `query_scalar` DISTINCT category_primary | [ ] |
| `get_transaction_by_id_for_user` | repository_service.rs:2115 | select_one | `transactions` | tenant-scoped | yes | WHERE id=$1 AND user_id=$2; returns Option | [ ] |
| `count_eligible_auto_categorize_transactions` | repository_service.rs:2442 | select_one | `transactions`, `transaction_category_overrides` | tenant-scoped | yes | COUNT WHERE category_primary='OTHER' AND no override for normalized_merchant | [ ] |
| `fetch_eligible_auto_categorize_transactions` | repository_service.rs:2471 | select_many | `transactions`, `transaction_category_overrides` | tenant-scoped | yes | Cursor-based pagination (after_date + after_id); keyset pagination requires raw SQL or escape hatch | [ ] |
| `update_transaction_categories_batch` | repository_service.rs:2580 | update | `transactions` | tenant-scoped | yes | Iterates updates slice, one UPDATE per item in transaction; no batch-update DSL in SeaORM — use sea_query `UpdateMany` or iterate ActiveModel | [ ] |

**Domain total: 17 methods, 19 SQLx call sites**

---

## Accounts

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `upsert_account` | repository_service.rs:565 | upsert | `accounts` | tenant-scoped | yes | ON CONFLICT (provider_account_id) DO UPDATE; user_id may be None (anonymous insert path) | [ ] |
| `get_accounts_for_user` | repository_service.rs:1678 | select_many | `accounts`, `provider_connections` | tenant-scoped | yes | LEFT JOIN provider_connections to get institution_name | [ ] |
| `get_latest_account_balances_for_user` | repository_service.rs:1912 | select_many | `accounts`, `provider_connections` | tenant-scoped | no | **Bug in current code**: `set_config` called on pool (not inside a transaction with `local=true`); `fetch_all` also runs on pool, not a tx — RLS context set per-statement only; maps to `LatestAccountBalance` via `sqlx::FromRow` | [ ] |

**Domain total: 3 methods, 5 SQLx call sites**

---

## Budgets

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `get_budgets_for_user` | repository_service.rs:1772 | select_many | `budgets` | tenant-scoped | yes | `query_as::<_, Budget>` uses `sqlx::FromRow` on `Budget` model | [ ] |
| `get_budget_by_id_for_user` | repository_service.rs:1794 | select_one | `budgets` | tenant-scoped | yes | Same `sqlx::FromRow` on `Budget` | [ ] |
| `create_budget_for_user` | repository_service.rs:1818 | insert | `budgets` | tenant-scoped | yes | Unique-violation check on `sqlx::Error::Database::is_unique_violation()` — SeaORM surfaces `DbErr::RecordNotInserted` or custom parsing | [ ] |
| `update_budget_for_user` | repository_service.rs:1854 | update | `budgets` | tenant-scoped | yes | Two queries in one tx: UPDATE amount + SELECT to return updated row | [ ] |
| `delete_budget_for_user` | repository_service.rs:1894 | delete | `budgets` | tenant-scoped | yes | DELETE WHERE id AND user_id | [ ] |

**Domain total: 5 methods, 7 SQLx call sites**

---

## Custom Categories

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `create_custom_category` | repository_service.rs:1980 | insert | `user_custom_categories` | tenant-scoped | yes | INSERT RETURNING; maps via `sqlx::FromRow` on `CustomCategory` | [ ] |
| `list_custom_categories_for_user` | repository_service.rs:2010 | select_many | `user_custom_categories` | tenant-scoped | yes | SELECT ordered by display_name; `sqlx::FromRow` on `CustomCategory` | [ ] |
| `delete_custom_category` | repository_service.rs:2034 | delete | `user_custom_categories` | tenant-scoped | yes | DELETE WHERE id AND user_id | [ ] |

**Domain total: 3 methods, 5 SQLx call sites**

---

## Category Overrides

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `upsert_transaction_category_override` | repository_service.rs:2052 | upsert | `transaction_category_overrides` | tenant-scoped | yes | ON CONFLICT (user_id, normalized_merchant) DO UPDATE; INSERT RETURNING; `sqlx::FromRow` on `TransactionCategoryOverride` | [ ] |
| `delete_transaction_category_override_by_norm` | repository_service.rs:2091 | delete | `transaction_category_overrides` | tenant-scoped | yes | DELETE WHERE user_id AND normalized_merchant | [ ] |

**Domain total: 2 methods, 4 SQLx call sites**

---

## Provider Connections

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `save_provider_connection` | repository_service.rs:777 | upsert | `provider_connections` | tenant-scoped | yes | ON CONFLICT (item_id) DO UPDATE many fields; 14-column INSERT | [ ] |
| `get_all_provider_connections_by_user` | repository_service.rs:827 | select_many | `provider_connections` | tenant-scoped | yes | `query_as` into 16-tuple; maps to `ProviderConnection` | [ ] |
| `get_provider_connection_by_id` | repository_service.rs:915 | select_one | `provider_connections` | tenant-scoped | yes | Same 16-tuple; WHERE id=$1 (no user_id filter — relies on RLS) | [ ] |
| `delete_provider_transactions` | repository_service.rs:1000 | delete | `provider_connections`, `transactions`, `accounts` | none | no | Looks up connection_id first (pool, no RLS), then deletes transactions via sub-SELECT on accounts; two separate executions on pool | [ ] |
| `delete_provider_accounts` | repository_service.rs:1026 | delete | `provider_connections`, `accounts` | none | no | Same pattern as above; looks up connection_id, deletes accounts by provider_connection_id | [ ] |
| `delete_provider_connection` | repository_service.rs:1045 | delete | `provider_connections` | tenant-scoped | yes | DELETE WHERE user_id AND item_id | [ ] |

**Domain total: 6 methods, 8 SQLx call sites**

---

## Provider Credentials (Encrypted)

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `store_provider_credentials_for_user` | repository_service.rs:705 | upsert | `provider_credentials` | tenant-scoped | yes | `encrypt_token(access_token)` before bind; ON CONFLICT (item_id) DO UPDATE; encrypted column: `encrypted_access_token BYTEA` | [ ] |
| `get_provider_credentials_for_user` | repository_service.rs:742 | select_one | `provider_credentials` | tenant-scoped | yes | Fetches raw `Vec<u8>`, calls `decrypt_token`; decrypted value placed into `PlaidCredentials.access_token`; **NOT using `sqlx::FromRow`** | [ ] |
| `delete_provider_credentials` | repository_service.rs:1062 | delete | `provider_credentials` | none | no | DELETE WHERE item_id; no user scoping (called after connection cleanup) | [ ] |

**Domain total: 3 methods, 5 SQLx call sites**

---

## SimpleFin

| Method | File:Line | Operation | Tables | RLS | Transaction | Notes | Status |
|--------|-----------|-----------|--------|-----|-------------|-------|--------|
| `store_simplefin_root_credential` | repository_service.rs:2194 | upsert | `simplefin_root_credentials` | tenant-scoped | yes | `encrypt_token(access_url)` before bind; ON CONFLICT (user_id) DO UPDATE; encrypted column: `encrypted_access_url BYTEA` | [ ] |
| `get_simplefin_root_credential` | repository_service.rs:2226 | select_one | `simplefin_root_credentials` | tenant-scoped | yes | `query_scalar` returns `Vec<u8>`, then `decrypt_token`; returns `Option<String>` | [ ] |
| `delete_simplefin_root_credential` | repository_service.rs:2246 | delete | `simplefin_root_credentials` | tenant-scoped | yes | Returns bool (rows_affected > 0) | [ ] |
| `list_simplefin_hidden_orgs` | repository_service.rs:2262 | select_many | `simplefin_hidden_orgs` | tenant-scoped | yes | `query_scalar` returns `HashSet<String>` of org_conn_id; no user_id filter in the query body (relies entirely on RLS) | [ ] |
| `list_simplefin_ignored_institutions` | repository_service.rs:2281 | select_many | `simplefin_hidden_orgs` | tenant-scoped | yes | `query_as` into 3-tuple; maps to `SimpleFinIgnoredInstitution` (inline struct, no `sqlx::FromRow`) | [ ] |
| `insert_simplefin_hidden_org` | repository_service.rs:2318 | upsert | `simplefin_hidden_orgs` | tenant-scoped | yes | ON CONFLICT (user_id, org_conn_id) DO UPDATE hidden_at | [ ] |
| `remove_simplefin_hidden_org` | repository_service.rs:2350 | delete | `simplefin_hidden_orgs` | tenant-scoped | yes | DELETE WHERE user_id AND org_conn_id; returns bool | [ ] |
| `disconnect_simplefin_org` | repository_service.rs:2370 | raw | `provider_connections`, `transactions`, `accounts`, `simplefin_hidden_orgs` | tenant-scoped | yes | Multi-step atomic operation: lookup connection → delete transactions (sub-SELECT) → delete accounts → delete provider_connection → upsert hidden_org; returns (deleted_transactions, deleted_accounts) counts | [ ] |

**Domain total: 8 methods, 10 SQLx call sites**

---

## Encrypted Columns

This sub-section is the source of truth for Phase 5 encrypted-column handling.

### AES-256-GCM format

All encrypted values use the same wire format: `[12-byte nonce][ciphertext]` stored as `BYTEA`. The key is `PostgresRepository::encryption_key: [u8; 32]`. Encrypt/decrypt helpers are private methods on `PostgresRepository`:

- `encrypt_token(&self, token: &str) -> Result<Vec<u8>>` — generates random 12-byte nonce per call
- `decrypt_token(&self, encrypted_data: &[u8]) -> Result<String>` — splits nonce from data, decrypts to UTF-8

The encryption/decryption seam lives entirely in the repository method bodies, not in model derives or `sqlx::FromRow` impls.

### Encrypted column inventory

| Column | Table | DB type | Repository methods | Model field | Seam location | Status |
|--------|-------|---------|-------------------|-------------|---------------|--------|
| `encrypted_access_token` | `provider_credentials` | `BYTEA` | `store_provider_credentials_for_user` (write), `get_provider_credentials_for_user` (read) | `PlaidCredentials.access_token: String` (plain; never stored encrypted) | Method body — encrypt before INSERT bind; decrypt after SELECT fetch | [ ] |
| `encrypted_access_url` | `simplefin_root_credentials` | `BYTEA` | `store_simplefin_root_credential` (write), `get_simplefin_root_credential` (read) | No model field — returned directly as `Option<String>` | Method body — encrypt before INSERT bind; decrypt after scalar fetch | [ ] |

### Phase 5 recommendation

Keep the encrypt/decrypt seam in the repository method body (current pattern). Neither column is read/written in more than two methods, so there is no meaningful duplication that would justify a custom `ValueType`/`TryGetable` impl. The SeaORM `ActiveModel` fields for these columns should use `Vec<u8>` (raw bytes); the method calls `encrypt_token`/`decrypt_token` around the DSL call, exactly as today.

---

## Cross-reference: trait methods vs call sites

All 54 methods on `DatabaseRepository` have at least one SQLx call site in `PostgresRepository`. No dead methods (zero call sites) were found.

### Methods without an explicit user_id in the query body (rely on RLS alone or operate un-scoped)

| Method | Scoping mechanism |
|--------|------------------|
| `get_provider_connection_by_id` | `set_config` in tx; WHERE clause uses `connection_id` only — user filter is RLS |
| `list_simplefin_hidden_orgs` | `set_config` in tx; SELECT has no explicit `WHERE user_id` — RLS only |
| `delete_provider_transactions` | No `set_config`; deletes via connection_id lookup (internal cascade path, no user-facing RLS needed) |
| `delete_provider_accounts` | Same as above |
| `delete_provider_credentials` | No `set_config`; deletes by item_id only (called after connection teardown) |

### Methods with a latent RLS bug

| Method | Issue |
|--------|-------|
| `get_latest_account_balances_for_user` | `set_config('app.current_user_id', $1, true)` is called with `local=true` but executed against the pool (not inside a transaction). `local=true` scopes to the current transaction — if there is no transaction, behavior is implementation-defined. The subsequent `fetch_all` runs on `&self.pool` separately. This likely works in practice only because the pool reuses the same connection, but it is not safe under connection churn. Phase 5 should fix this by routing through `with_tenant`. |

### Methods not on `DatabaseRepository` trait (internal helpers, no trait leak)

| Symbol | Role |
|--------|------|
| `PostgresRepository::encrypt_token` | Internal encryption helper |
| `PostgresRepository::decrypt_token` | Internal decryption helper |
| `PostgresRepository::map_user_row` | Row-to-model mapper |
| `PostgresRepository::map_transaction_with_account_row` | Row-to-model mapper |
| `PostgresRepository::map_transaction_insights_row` | Row-to-model mapper |
| `PostgresRepository::append_transaction_filters` | Dynamic query builder helper (used by paginated/count/insights methods) |
| `PostgresRepository::append_category_exclusion` | Dynamic query builder helper (excludes analytics categories) |

---

## Models with `sqlx::FromRow` to remove in Phase 5

| Model | File | Notes |
|-------|------|-------|
| `Budget` | `backend/src/models/budget.rs:10` | Used by `get_budgets_for_user`, `get_budget_by_id_for_user`, `update_budget_for_user` |
| `CustomCategory` | `backend/src/models/custom_category.rs:7` | Used by `create_custom_category`, `list_custom_categories_for_user` |
| `TransactionCategoryOverride` | `backend/src/models/transaction_category_override.rs:7` | Used by `upsert_transaction_category_override` |
| `LatestAccountBalance` | `backend/src/models/plaid.rs:247` | Used by `get_latest_account_balances_for_user` |
| `TransactionWithAccountRow` | `backend/src/services/repository_service.rs:25` | Internal struct in repository_service; not a public model — remove along with the file rewrite |

---

## TDD Log — Phase 1

Phase 1 is documentation-only. No tests to run; no code changed outside `docs/seaorm-migration/`.

Verification: `grep -r "sqlx" backend/src --include="*.rs" -l` still shows the original files untouched.
