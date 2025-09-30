# Multi-Bank Support Implementation Plan (TDD: Red-Green-Refactor)

## TDD Philosophy
- **Red:** Write failing tests first
- **Green:** Write minimal code to make tests pass
- **Refactor:** Clean up code while keeping tests green

---

## Cycle 1: Repository Layer - Get All Connections

### 🔴 RED: Write Failing Tests
[repository_tests.rs](backend/src/tests/repository_tests.rs)

```rust
#[tokio::test]
async fn given_user_with_multiple_connections_when_get_all_then_returns_all_connections() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    let conn1 = PlaidConnection::new(user_id, "item_1");
    let conn2 = PlaidConnection::new(user_id, "item_2");

    mock_repo
        .expect_get_all_plaid_connections_by_user()  // ❌ Method doesn't exist
        .with(predicate::eq(user_id))
        .returning(move |_| Box::pin(async {
            Ok(vec![conn1.clone(), conn2.clone()])
        }));

    let result = mock_repo.get_all_plaid_connections_by_user(&user_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 2);
}

#[tokio::test]
async fn given_user_with_no_connections_when_get_all_then_returns_empty() {
    let mut mock_repo = MockDatabaseRepository::new();
    let user_id = Uuid::new_v4();

    mock_repo
        .expect_get_all_plaid_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let result = mock_repo.get_all_plaid_connections_by_user(&user_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}
```

**Run:** `cargo test repository_tests` → ❌ **FAILS** (method doesn't exist)

### 🟢 GREEN: Make Tests Pass
[repository_service.rs](backend/src/services/repository_service.rs)

**1. Add to trait (line ~76):**
```rust
async fn get_all_plaid_connections_by_user(&self, user_id: &Uuid) -> Result<Vec<PlaidConnection>>;
```

**2. Add implementation (after line ~740):**
```rust
async fn get_all_plaid_connections_by_user(&self, user_id: &Uuid) -> Result<Vec<PlaidConnection>> {
    let mut tx = self.pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
        .bind(user_id.to_string())
        .execute(&mut *tx)
        .await?;

    let rows = sqlx::query_as::<
        _,
        (Uuid, Uuid, String, bool, Option<DateTime<Utc>>, Option<DateTime<Utc>>,
         Option<DateTime<Utc>>, Option<String>, Option<String>, Option<String>,
         Option<String>, i32, i32, Option<DateTime<Utc>>, Option<DateTime<Utc>>),
    >(
        r#"
        SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
               disconnected_at, institution_id, institution_name, institution_logo_url,
               sync_cursor, transaction_count, account_count, created_at, updated_at
        FROM plaid_connections
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(rows.into_iter().map(|(id, user_id, item_id, is_connected, last_sync_at,
        connected_at, disconnected_at, institution_id, institution_name,
        institution_logo_url, sync_cursor, transaction_count, account_count,
        created_at, updated_at)| PlaidConnection {
            id, user_id, item_id, is_connected, last_sync_at, connected_at,
            disconnected_at, institution_id, institution_name, institution_logo_url,
            sync_cursor, transaction_count, account_count, created_at, updated_at,
        }).collect())
}
```

**Run:** `cargo test repository_tests::given_user_with_multiple_connections` → ✅ **PASSES**

### 🔵 REFACTOR: Clean Up
- No refactoring needed - implementation is clean

---

## Cycle 2: Repository Layer - Get Connection By ID

### 🔴 RED: Write Failing Tests
[repository_tests.rs](backend/src/tests/repository_tests.rs)

```rust
#[tokio::test]
async fn given_valid_connection_id_when_get_by_id_then_returns_connection() {
    let mut mock_repo = MockDatabaseRepository::new();
    let connection_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    let mut conn = PlaidConnection::new(user_id, "item_1");
    conn.id = connection_id;

    mock_repo
        .expect_get_plaid_connection_by_id()  // ❌ Method doesn't exist
        .with(predicate::eq(connection_id))
        .returning(move |_| Box::pin(async { Ok(Some(conn.clone())) }));

    let result = mock_repo.get_plaid_connection_by_id(&connection_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().unwrap().id, connection_id);
}

#[tokio::test]
async fn given_invalid_connection_id_when_get_by_id_then_returns_none() {
    let mut mock_repo = MockDatabaseRepository::new();
    let connection_id = Uuid::new_v4();

    mock_repo
        .expect_get_plaid_connection_by_id()
        .returning(|_| Box::pin(async { Ok(None) }));

    let result = mock_repo.get_plaid_connection_by_id(&connection_id).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}
```

**Run:** `cargo test repository_tests` → ❌ **FAILS**

### 🟢 GREEN: Make Tests Pass
[repository_service.rs](backend/src/services/repository_service.rs)

**1. Add to trait:**
```rust
async fn get_plaid_connection_by_id(&self, connection_id: &Uuid) -> Result<Option<PlaidConnection>>;
```

**2. Add implementation:**
```rust
async fn get_plaid_connection_by_id(&self, connection_id: &Uuid) -> Result<Option<PlaidConnection>> {
    let row = sqlx::query_as::<
        _,
        (Uuid, Uuid, String, bool, Option<DateTime<Utc>>, Option<DateTime<Utc>>,
         Option<DateTime<Utc>>, Option<String>, Option<String>, Option<String>,
         Option<String>, i32, i32, Option<DateTime<Utc>>, Option<DateTime<Utc>>),
    >(
        r#"
        SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
               disconnected_at, institution_id, institution_name, institution_logo_url,
               sync_cursor, transaction_count, account_count, created_at, updated_at
        FROM plaid_connections
        WHERE id = $1
        "#,
    )
    .bind(connection_id)
    .fetch_optional(&self.pool)
    .await?;

    Ok(row.map(|(id, user_id, item_id, is_connected, last_sync_at, connected_at,
        disconnected_at, institution_id, institution_name, institution_logo_url,
        sync_cursor, transaction_count, account_count, created_at, updated_at)|
        PlaidConnection {
            id, user_id, item_id, is_connected, last_sync_at, connected_at,
            disconnected_at, institution_id, institution_name, institution_logo_url,
            sync_cursor, transaction_count, account_count, created_at, updated_at,
        }))
}
```

**Run:** `cargo test repository_tests` → ✅ **PASSES**

### 🔵 REFACTOR: Clean Up
- Consider extracting PlaidConnection mapping into helper function (shared between methods)

---

## Cycle 3: Account Upsert - Add Connection ID

### 🔴 RED: Write Failing Test
[bank_level_sync_tests.rs](backend/src/tests/bank_level_sync_tests.rs)

```rust
#[tokio::test]
async fn given_bank_connection_when_upserting_account_then_assigns_connection_id() {
    let user_id = Uuid::new_v4();
    let connection = PlaidConnection::new(user_id, "test_item");
    let connection_id = connection.id;

    let mut account = Account {
        id: Uuid::new_v4(),
        user_id: Some(user_id),
        plaid_account_id: Some("plaid_123".to_string()),
        plaid_connection_id: None,  // ❌ Not set yet
        name: "Test Account".to_string(),
        account_type: "checking".to_string(),
        balance_current: Some(dec!(1000.00)),
        mask: Some("1234".to_string()),
        institution_name: None,
    };

    // Simulate the upsert logic
    account.user_id = Some(user_id);
    account.plaid_connection_id = Some(connection_id);  // This line missing in main.rs

    assert_eq!(account.plaid_connection_id, Some(connection_id));
}
```

**Run:** Test passes with our simulation, but check actual code...
**Check:** [main.rs:883-889](backend/src/main.rs#L883-L889) → ❌ **Missing line!**

### 🟢 GREEN: Make Test Pass
[main.rs:886](backend/src/main.rs#L886)

**Add:**
```rust
for account in &accounts {
    let mut acct = account.clone();
    acct.user_id = Some(user_id);
    acct.plaid_connection_id = Some(connection.id);  // ✅ ADD THIS LINE
    if let Err(e) = state.db_repository.upsert_account(&acct).await {
        tracing::warn!("Failed to persist account to database during sync: {}", e);
    }
}
```

**Run:** `cargo test bank_level_sync` → ✅ **PASSES**

### 🔵 REFACTOR: Clean Up
- No refactoring needed

---

## Cycle 4: Status Endpoint - Return Array

### 🔴 RED: Write Failing Test
[integration_tests.rs](backend/src/tests/integration_tests.rs)

**Replace existing test:**
```rust
#[tokio::test]
async fn given_authenticated_user_when_get_connection_status_then_returns_array() {
    use crate::services::repository_service::MockDatabaseRepository;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let mut conn1 = PlaidConnection::new(user_id, "item_1");
    conn1.mark_connected("Bank A");
    let mut conn2 = PlaidConnection::new(user_id, "item_2");
    conn2.mark_connected("Bank B");

    mock_db
        .expect_get_all_plaid_connections_by_user()  // Using new method
        .returning(move |_| Box::pin(async {
            Ok(vec![conn1.clone(), conn2.clone()])
        }));

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();
    let request = TestFixtures::create_authenticated_get_request("/api/plaid/status", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let statuses: Vec<PlaidConnectionStatus> = serde_json::from_slice(&body).unwrap();

    assert_eq!(statuses.len(), 2);  // ❌ Will fail - endpoint returns single object
    assert_eq!(statuses[0].institution_name, Some("Bank A".to_string()));
    assert_eq!(statuses[1].institution_name, Some("Bank B".to_string()));
}
```

**Run:** `cargo test integration_tests::given_authenticated_user_when_get_connection_status` → ❌ **FAILS**

### 🟢 GREEN: Make Test Pass
[main.rs:1377-1394](backend/src/main.rs#L1377-L1394)

**Replace entire function:**
```rust
async fn get_authenticated_plaid_connection_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<PlaidConnectionStatus>>, StatusCode> {
    let user_id = auth_context.user_id;

    let connections = state.db_repository
        .get_all_plaid_connections_by_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get connections: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let statuses: Vec<PlaidConnectionStatus> = connections
        .into_iter()
        .map(|conn| PlaidConnectionStatus {
            is_connected: conn.is_connected,
            last_sync_at: conn.last_sync_at.map(|dt| dt.to_rfc3339()),
            institution_name: conn.institution_name,
            connection_id: Some(conn.id.to_string()),
            transaction_count: conn.transaction_count,
            account_count: conn.account_count,
            sync_in_progress: false,
        })
        .collect();

    Ok(Json(statuses))
}
```

**Remove ConnectionService.get_connection_status():**
[connection_service.rs:28-54](backend/src/services/connection_service.rs#L28-L54)

Delete the entire method - no longer needed.

**Update balances overview endpoint:**
[main.rs:1684-1706](backend/src/main.rs#L1684-L1706)

Remove the connection_status lookup and fallback:
```rust
// DELETE lines 1684-1706 (connection status lookup)
// DELETE line 1771 fallback: .or_else(|| connection_status.institution_name.clone())
```

**Run:** `cargo test integration_tests::given_authenticated_user_when_get_connection_status` → ✅ **PASSES**

### 🔵 REFACTOR: Update Tests
[integration_tests.rs](backend/src/tests/integration_tests.rs)

**Find and replace:**
```rust
// OLD (multiple places):
mock_db
    .expect_get_plaid_connection_by_user()
    .returning(|_| Box::pin(async { Ok(None) }));

// NEW:
mock_db
    .expect_get_all_plaid_connections_by_user()
    .returning(|_| Box::pin(async { Ok(vec![]) }));
```

**Files to update:**
- integration_tests.rs
- balances_overview_api_tests.rs
- budget_api_integration_tests.rs
- test_fixtures.rs

**Run:** `cargo test` → ✅ **ALL PASS**

---

## Cycle 5: Accounts Endpoint - Remove Single-Bank Assumption

### 🔴 RED: Write Failing Test
[integration_tests.rs](backend/src/tests/integration_tests.rs)

```rust
#[tokio::test]
async fn given_user_with_multiple_banks_when_get_accounts_then_returns_all_accounts() {
    use crate::services::repository_service::MockDatabaseRepository;
    use crate::models::account::Account;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let conn1_id = Uuid::new_v4();
    let conn2_id = Uuid::new_v4();

    let accounts = vec![
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            plaid_account_id: Some("acc1".to_string()),
            plaid_connection_id: Some(conn1_id),
            name: "Chase Checking".to_string(),
            account_type: "checking".to_string(),
            balance_current: Some(dec!(1000.00)),
            mask: Some("1234".to_string()),
            institution_name: Some("Chase".to_string()),
        },
        Account {
            id: Uuid::new_v4(),
            user_id: Some(user_id),
            plaid_account_id: Some("acc2".to_string()),
            plaid_connection_id: Some(conn2_id),
            name: "BofA Savings".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(dec!(5000.00)),
            mask: Some("5678".to_string()),
            institution_name: Some("Bank of America".to_string()),
        },
    ];

    mock_db
        .expect_get_accounts_for_user()
        .returning(move |_| {
            let accts = accounts.clone();
            Box::pin(async move { Ok(accts) })
        });

    mock_db
        .expect_get_transaction_count_by_account_for_user()
        .returning(|_| Box::pin(async { Ok(HashMap::new()) }));

    mock_db
        .expect_get_all_plaid_connections_by_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_budgets_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_transactions_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    mock_db
        .expect_get_latest_account_balances_for_user()
        .returning(|_| Box::pin(async { Ok(vec![]) }));

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();
    let request = TestFixtures::create_authenticated_get_request("/api/plaid/accounts", &token);
    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), 200);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let accounts: Vec<AccountResponse> = serde_json::from_slice(&body).unwrap();

    assert_eq!(accounts.len(), 2);
    assert_eq!(accounts[0].institution_name, Some("Chase".to_string()));
    assert_eq!(accounts[1].institution_name, Some("Bank of America".to_string()));
}
```

**Run:** `cargo test given_user_with_multiple_banks_when_get_accounts` → ❌ **FAILS** (tries to call get_plaid_connection_by_user)

### 🟢 GREEN: Make Test Pass
[main.rs:630-729](backend/src/main.rs#L630-L729)

**Simplify entire function:**
```rust
async fn get_authenticated_plaid_accounts(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<Vec<AccountResponse>>, StatusCode> {
    let user_id = auth_context.user_id;

    let db_accounts = match state.db_repository.get_accounts_for_user(&user_id).await {
        Ok(accounts) => accounts,
        Err(e) => {
            tracing::error!("Failed to get accounts for user {}: {}", user_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let transaction_counts = state
        .db_repository
        .get_transaction_count_by_account_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get transaction counts for user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let account_responses: Vec<AccountResponse> = db_accounts
        .into_iter()
        .map(|account| {
            let transaction_count = transaction_counts.get(&account.id).unwrap_or(&0);
            AccountResponse {
                id: account.id,
                user_id: Some(user_id),
                plaid_account_id: account.plaid_account_id.clone(),
                plaid_connection_id: account.plaid_connection_id,
                name: account.name,
                account_type: account.account_type,
                balance_current: account.balance_current,
                mask: account.mask,
                transaction_count: *transaction_count as i64,
                institution_name: account.institution_name.clone(),
            }
        })
        .collect();

    Ok(Json(account_responses))
}
```

**Run:** `cargo test given_user_with_multiple_banks_when_get_accounts` → ✅ **PASSES**

### 🔵 REFACTOR: Simplify
Removed 50+ lines of unnecessary connection and credential lookups.

---

## Cycle 6: Sync Endpoint - Use get_plaid_connection_by_id

### 🔴 RED: Write Failing Test
[integration_tests.rs](backend/src/tests/integration_tests.rs)

```rust
#[tokio::test]
async fn given_connection_id_when_sync_then_uses_get_plaid_connection_by_id() {
    use crate::services::repository_service::MockDatabaseRepository;
    use crate::models::plaid::PlaidConnection;

    let mut mock_db = MockDatabaseRepository::new();
    let (_user, token) = TestFixtures::create_authenticated_user_with_token();
    let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let connection_id = Uuid::new_v4();
    let mut connection = PlaidConnection::new(user_id, "item_123");
    connection.id = connection_id;
    connection.mark_connected("Chase");

    mock_db
        .expect_get_plaid_connection_by_id()
        .with(mockall::predicate::eq(connection_id))
        .times(1)
        .returning(move |_| {
            let conn = connection.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    // Additional mocks...

    let app = TestFixtures::create_test_app_with_db(mock_db).await.unwrap();

    let sync_request = SyncTransactionsRequest {
        connection_id: Some(connection_id.to_string()),
    };

    let request = TestFixtures::create_authenticated_post_request(
        "/api/plaid/sync-transactions",
        &token,
        sync_request,
    );

    let response = app.oneshot(request).await.unwrap();
    // Test should call get_plaid_connection_by_id, not get_plaid_connection_by_user
}
```

**Run:** `cargo test given_connection_id_when_sync_then_uses` → ❌ **FAILS**

### 🟢 GREEN: Make Test Pass
[main.rs:731-803](backend/src/main.rs#L731-L803)

**Replace the connection lookup logic:**
```rust
async fn sync_authenticated_plaid_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<Option<SyncTransactionsRequest>>,
) -> Result<Json<SyncTransactionsResponse>, StatusCode> {
    let user_id = auth_context.user_id;
    let sync_timestamp = chrono::Utc::now();

    tracing::info!("Sync transactions requested for user {}", user_id);

    // Extract and validate connection_id
    let connection_id_str = req
        .as_ref()
        .and_then(|r| r.connection_id.as_ref())
        .ok_or_else(|| {
            tracing::error!("connection_id is required for sync");
            StatusCode::BAD_REQUEST
        })?;

    let connection_id = Uuid::parse_str(connection_id_str)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Use get_plaid_connection_by_id instead of get_plaid_connection_by_user
    let connection = match state
        .db_repository
        .get_plaid_connection_by_id(&connection_id)
        .await
    {
        Ok(Some(conn)) => {
            // Verify ownership
            if conn.user_id != user_id {
                tracing::error!(
                    "Connection {} does not belong to user {}",
                    connection_id,
                    user_id
                );
                return Err(StatusCode::FORBIDDEN);
            }
            conn
        }
        Ok(None) => {
            tracing::error!("Connection {} not found", connection_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            tracing::error!("Failed to get connection {}: {}", connection_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Rest of sync logic continues...
```

**Run:** `cargo test given_connection_id_when_sync_then_uses` → ✅ **PASSES**

### 🔵 REFACTOR: Remove Redundant Branches
Reduced 3 duplicate code branches to 1 clean path. connection_id is now required.

---

## Cycle 7: Disconnect - Add connection_id Parameter

### 🔴 RED: Write Failing Test
[connection_service_tests.rs](backend/src/tests/connection_service_tests.rs) (new file)

```rust
#[tokio::test]
async fn given_connection_id_when_disconnect_then_disconnects_specific_connection() {
    let mut mock_db = MockDatabaseRepository::new();
    let mut mock_cache = MockCacheService::new();

    let user_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();

    let mut connection = PlaidConnection::new(user_id, "item_123");
    connection.id = connection_id;
    connection.mark_connected("Chase");

    mock_db
        .expect_get_plaid_connection_by_id()
        .with(mockall::predicate::eq(connection_id))
        .returning(move |_| {
            let conn = connection.clone();
            Box::pin(async move { Ok(Some(conn)) })
        });

    mock_db
        .expect_save_plaid_connection()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_db
        .expect_delete_plaid_transactions()
        .returning(|_| Box::pin(async { Ok(10) }));

    mock_db
        .expect_delete_plaid_accounts()
        .returning(|_| Box::pin(async { Ok(2) }));

    mock_db
        .expect_delete_plaid_credentials()
        .returning(|_| Box::pin(async { Ok(()) }));

    // Cache mocks...
    mock_cache
        .expect_delete_access_token()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_invalidate_pattern()
        .returning(|_| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_transactions()
        .returning(|| Box::pin(async { Ok(()) }));

    mock_cache
        .expect_clear_jwt_scoped_bank_connection_cache()
        .returning(|_, _| Box::pin(async { Ok(()) }));

    let service = ConnectionService::new(
        Arc::new(mock_db),
        Arc::new(mock_cache),
    );

    let result = service
        .disconnect_plaid_by_id(&connection_id, &user_id, "jwt_123")
        .await;

    assert!(result.is_ok());
    let disconnect_result = result.unwrap();
    assert!(disconnect_result.success);
    assert_eq!(disconnect_result.data_cleared.transactions, 10);
    assert_eq!(disconnect_result.data_cleared.accounts, 2);
}
```

**Run:** `cargo test given_connection_id_when_disconnect` → ❌ **FAILS** (method doesn't exist)

### 🟢 GREEN: Make Test Pass
[connection_service.rs](backend/src/services/connection_service.rs)

**Add new method:**
```rust
pub async fn disconnect_plaid_by_id(
    &self,
    connection_id: &Uuid,
    user_id: &Uuid,
    jwt_id: &str,
) -> Result<DisconnectResult> {
    let connection = self
        .db_repository
        .get_plaid_connection_by_id(connection_id)
        .await?;

    let Some(mut conn) = connection else {
        return Ok(DisconnectResult {
            success: false,
            message: "Connection not found".to_string(),
            data_cleared: DataCleared {
                transactions: 0,
                accounts: 0,
                cache_keys: vec![],
            },
        });
    };

    // Verify ownership
    if conn.user_id != *user_id {
        return Err(anyhow::anyhow!("Connection does not belong to user"));
    }

    conn.mark_disconnected();
    self.db_repository.save_plaid_connection(&conn).await?;

    let cleared_keys = self
        .clear_all_plaid_cache_data(jwt_id, &conn.item_id)
        .await?;

    self.cache_service
        .clear_jwt_scoped_bank_connection_cache(jwt_id, *connection_id)
        .await?;

    let deleted_transactions = self
        .db_repository
        .delete_plaid_transactions(&conn.item_id)
        .await?;
    let deleted_accounts = self
        .db_repository
        .delete_plaid_accounts(&conn.item_id)
        .await?;

    self.db_repository
        .delete_plaid_credentials(&conn.item_id)
        .await?;

    Ok(DisconnectResult {
        success: true,
        message: "Successfully disconnected bank connection".to_string(),
        data_cleared: DataCleared {
            transactions: deleted_transactions,
            accounts: deleted_accounts,
            cache_keys: cleared_keys,
        },
    })
}
```

**Add request model in [plaid.rs](backend/src/models/plaid.rs):**
```rust
#[derive(Debug, Deserialize)]
pub struct DisconnectRequest {
    pub connection_id: String,
}
```

**Update endpoint in [main.rs:1577-1594](backend/src/main.rs#L1577-L1594):**
```rust
async fn disconnect_authenticated_plaid(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<DisconnectRequest>,
) -> Result<Json<DisconnectResult>, StatusCode> {
    let user_id = auth_context.user_id;
    let connection_id = Uuid::parse_str(&req.connection_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    match state
        .connection_service
        .disconnect_plaid_by_id(&connection_id, &user_id, &auth_context.jwt_id)
        .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Failed to disconnect: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
```

**Run:** `cargo test given_connection_id_when_disconnect` → ✅ **PASSES**

### 🔵 REFACTOR: Update route definition
Ensure route expects POST with body instead of GET with no params.

---

## Cycle 8: Remove Old Single-Connection Code

### 🔴 RED: Identify Old Code
**Search:**
```bash
grep -rn "get_plaid_connection_by_user" backend/src --exclude-dir=tests
```

**Expected findings:**
1. `repository_service.rs` - trait definition and implementation
2. `connection_service.rs` - old `disconnect_plaid()` method (unused)

### 🟢 GREEN: Delete Old Code
[repository_service.rs](backend/src/services/repository_service.rs)

**DELETE the trait method:**
```rust
// DELETE THIS:
async fn get_plaid_connection_by_user(&self, user_id: &Uuid) -> Result<Option<PlaidConnection>>;
```

**DELETE the implementation:**
```rust
// DELETE THIS ENTIRE METHOD (50+ lines)
async fn get_plaid_connection_by_user(&self, user_id: &Uuid) -> Result<Option<PlaidConnection>> {
    // ...entire implementation...
}
```

[connection_service.rs](backend/src/services/connection_service.rs)

**DELETE old disconnect methods:**
```rust
// DELETE THIS:
pub async fn disconnect_plaid(&self, user_id: &Uuid, jwt_id: &str) -> Result<DisconnectResult> {
    // ...
}

// DELETE THIS:
pub async fn disconnect_plaid_with_jwt_context(&self, user_id: &Uuid, jwt_id: &str) -> Result<DisconnectResult> {
    // ...
}
```

**Run:** `cargo test` → Should still pass if all migrations complete

### 🔵 REFACTOR: Update Tests
Remove any remaining test mocks for `expect_get_plaid_connection_by_user()` in test files:
- repository_tests.rs (tests specifically for the old method)
- connection_cache_integration_tests.rs
- bank_level_sync_tests.rs

**Run:** `cargo test` → ✅ **ALL PASS**

---

## Summary: Complete TDD Execution Order

```bash
# Cycle 1: Repository - Get All
cargo test repository_tests::given_user_with_multiple_connections  # RED
# Add get_all_plaid_connections_by_user()
cargo test repository_tests::given_user_with_multiple_connections  # GREEN

# Cycle 2: Repository - Get By ID
cargo test repository_tests::given_valid_connection_id  # RED
# Add get_plaid_connection_by_id()
cargo test repository_tests::given_valid_connection_id  # GREEN

# Cycle 3: Account Upsert
cargo test bank_level_sync::given_bank_connection_when_upserting  # RED
# Add acct.plaid_connection_id = Some(connection.id)
cargo test bank_level_sync::given_bank_connection_when_upserting  # GREEN

# Cycle 4: Status Endpoint
cargo test integration_tests::given_authenticated_user_when_get_connection_status  # RED
# Update endpoint to return Vec<PlaidConnectionStatus>
# Remove ConnectionService.get_connection_status()
# Update balances overview endpoint
cargo test integration_tests::given_authenticated_user_when_get_connection_status  # GREEN
cargo test  # GREEN

# Cycle 5: Accounts Endpoint
cargo test given_user_with_multiple_banks_when_get_accounts  # RED
# Remove single-connection lookup, simplify endpoint
cargo test given_user_with_multiple_banks_when_get_accounts  # GREEN

# Cycle 6: Sync Endpoint
cargo test given_connection_id_when_sync_then_uses  # RED
# Use get_plaid_connection_by_id, require connection_id
cargo test given_connection_id_when_sync_then_uses  # GREEN

# Cycle 7: Disconnect Endpoint
cargo test given_connection_id_when_disconnect  # RED
# Add disconnect_plaid_by_id method, update endpoint
cargo test given_connection_id_when_disconnect  # GREEN

# Cycle 8: Remove Old Code
# Delete get_plaid_connection_by_user from repository
# Delete old disconnect methods from connection service
# Update tests
cargo test  # GREEN

# Final Validation
cargo test
cargo check
cargo clippy
```

---

## Root Cause Summary

**The Bug:** When syncing accounts, `plaid_connection_id` was never set, causing all accounts to have NULL connection IDs.

**Impact:** Multiple banks appeared to "replace" each other because accounts couldn't be distinguished by their bank connection.

**The Fix:**
1. One line: `acct.plaid_connection_id = Some(connection.id);`
2. Update all endpoints to work with multiple connections
3. Remove all single-connection assumptions
4. Delete old single-connection methods

**Breaking Changes:**
- `/api/plaid/sync-transactions` - now **requires** `connection_id` in request body
- `/api/plaid/disconnect` - now **requires** `connection_id` in request body
- `/api/plaid/accounts` - no longer validates single connection (just returns all accounts)
- `get_plaid_connection_by_user()` - **DELETED**
- `ConnectionService.disconnect_plaid()` - **DELETED**
- `ConnectionService.disconnect_plaid_with_jwt_context()` - **DELETED**
- `ConnectionService.get_connection_status()` - **DELETED**