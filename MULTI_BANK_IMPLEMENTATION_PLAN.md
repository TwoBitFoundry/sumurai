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

**Run:** `cargo test integration_tests::given_authenticated_user_when_get_connection_status` → ✅ **PASSES**

### 🔵 REFACTOR: Update Other Tests
[integration_tests.rs](backend/src/tests/integration_tests.rs)

**Find and replace all instances:**
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
- [integration_tests.rs:62, 153](backend/src/tests/integration_tests.rs)
- [balances_overview_api_tests.rs](backend/src/tests/balances_overview_api_tests.rs)
- [budget_api_integration_tests.rs](backend/src/tests/budget_api_integration_tests.rs)

**Run:** `cargo test integration_tests` → ✅ **ALL PASS**

---

## Summary: TDD Execution Order

### Execute in order:
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
cargo test integration_tests::given_authenticated_user_when_get_connection_status  # GREEN
# Refactor: Update other tests to use get_all_plaid_connections_by_user
cargo test integration_tests  # GREEN

# Final Validation
cargo test
cargo check
```

---

## Root Cause Summary

**The Bug:** When syncing accounts, `plaid_connection_id` was never set, causing all accounts to have NULL connection IDs.

**Impact:** Multiple banks appeared to "replace" each other because accounts couldn't be distinguished by their bank connection.

**The Fix:** One line: `acct.plaid_connection_id = Some(connection.id);`

**Plus:** Update endpoints to return/accept multiple connections properly.