use sqlx::{PgPool, Row};
use uuid::Uuid;

async fn connect_pool() -> Option<PgPool> {
    // Skip database tests if no DATABASE_URL is explicitly set
    if std::env::var("DATABASE_URL").is_err() {
        eprintln!("[migration_tests] Skipping: DATABASE_URL not set for integration tests");
        return None;
    }

    let database_url = std::env::var("DATABASE_URL").unwrap();
    match PgPool::connect(&database_url).await {
        Ok(pool) => Some(pool),
        Err(err) => {
            eprintln!("[migration_tests] Skipping: cannot connect to DB: {}", err);
            None
        }
    }
}

async fn create_pre_migration_table(pool: &PgPool, table: &str) -> Result<(), sqlx::Error> {
    let uq_name = format!("{}_user_id_category_month_key", table);
    let idx_month = format!("idx_{}_month", table);
    let idx_user_month = format!("idx_{}_user_month", table);

    let stmts = vec![
        format!(
            r#"CREATE TABLE IF NOT EXISTS {table} (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                category VARCHAR NOT NULL,
                month VARCHAR NOT NULL,
                amount DECIMAL NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT {uq_name} UNIQUE(user_id, category, month)
            )"#
        ),
        format!("CREATE INDEX IF NOT EXISTS {idx_month} ON {table}(month)"),
        format!("CREATE INDEX IF NOT EXISTS {idx_user_month} ON {table}(user_id, month)"),
    ];
    for s in stmts {
        sqlx::query(&s).execute(pool).await?;
    }
    Ok(())
}

fn adapt_migration_sql_for_table(sql: &str, table: &str) -> String {
    let mut out = sql.replace(
        "budgets_user_id_category_month_key",
        &format!("{}_user_id_category_month_key", table),
    );
    out = out.replace("idx_budgets_month", &format!("idx_{}_month", table));
    out = out.replace(
        "idx_budgets_user_month",
        &format!("idx_{}_user_month", table),
    );
    out = out.replace(
        "budgets_user_id_category_unique",
        &format!("{}_user_id_category_unique", table),
    );
    out = out.replace(
        "budgets_user_id_category_unique_idx",
        &format!("{}_user_id_category_unique_idx", table),
    );
    out = out.replace(" ON budgets(", &format!(" ON {}(", table));
    out = out.replace(" ON budgets (", &format!(" ON {} (", table));
    out = out.replace(
        "USING INDEX budgets_user_id_category_unique_idx",
        &format!("USING INDEX {}_user_id_category_unique_idx", table),
    );

    out = out.replace("ALTER TABLE budgets", &format!("ALTER TABLE {}", table));
    out = out.replace("DELETE FROM budgets", &format!("DELETE FROM {}", table));
    out = out.replace("FROM budgets ", &format!("FROM {} ", table));
    out = out.replace("FROM budgets\n", &format!("FROM {}\n", table));
    out = out.replace("USING budgets ", &format!("USING {} ", table));
    out
}

async fn insert_budget(
    pool: &PgPool,
    table: &str,
    user_id: Uuid,
    category: &str,
    month: &str,
    amount: f64,
    updated_at_iso: &str,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    let updated_at = chrono::NaiveDateTime::parse_from_str(updated_at_iso, "%Y-%m-%dT%H:%M:%SZ")
        .unwrap()
        .and_utc();
    let created_at = updated_at;
    let sql = format!(
        "INSERT INTO {table} (id, user_id, category, month, amount, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)"
    );
    sqlx::query(&sql)
        .bind(id)
        .bind(user_id)
        .bind(category)
        .bind(month)
        .bind(amount)
        .bind(created_at)
        .bind(updated_at)
        .execute(pool)
        .await?;
    Ok(id)
}

async fn month_column_exists(pool: &PgPool, table: &str) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'month'",
    )
    .bind(table)
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

#[tokio::test]
async fn given_month_based_duplicates_when_migration_runs_then_deduplicates_and_preserves_latest() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let tname = format!(
        "budgets_migtest_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    create_pre_migration_table(&pool, &tname).await.unwrap();

    let user_id = Uuid::new_v4();
    // Two months for same category; latest should be kept
    insert_budget(
        &pool,
        &tname,
        user_id,
        "FOOD_AND_DRINK",
        "2024-01",
        100.0,
        "2024-01-01T00:00:00Z",
    )
    .await
    .unwrap();
    insert_budget(
        &pool,
        &tname,
        user_id,
        "FOOD_AND_DRINK",
        "2024-05",
        300.0,
        "2024-05-01T00:00:00Z",
    )
    .await
    .unwrap();
    // Another category single row to ensure unaffected
    insert_budget(
        &pool,
        &tname,
        user_id,
        "RENT",
        "2024-05",
        1200.0,
        "2024-05-02T00:00:00Z",
    )
    .await
    .unwrap();

    // Apply migration (adapted to test table)
    let sql = include_str!("../../migrations/010_budgets_monthless.sql");
    let adapted = adapt_migration_sql_for_table(sql, &tname);

    // Parse statements properly by handling multi-line statements
    let mut statements = Vec::new();
    let mut current_statement = String::new();
    let mut paren_depth = 0;
    let mut in_string = false;
    let mut escape_next = false;

    for line in adapted.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("--") || trimmed.is_empty() {
            continue;
        }

        for c in line.chars() {
            if escape_next {
                escape_next = false;
                current_statement.push(c);
                continue;
            }

            match c {
                '\\' if in_string => escape_next = true,
                '\'' => in_string = !in_string,
                '(' if !in_string => paren_depth += 1,
                ')' if !in_string => paren_depth -= 1,
                ';' if !in_string && paren_depth == 0 => {
                    current_statement.push(c);
                    if !current_statement.trim().is_empty() {
                        statements.push(current_statement.trim().to_string());
                    }
                    current_statement.clear();
                    continue;
                }
                _ => {}
            }
            current_statement.push(c);
        }
        current_statement.push('\n');
    }

    if !current_statement.trim().is_empty() {
        statements.push(current_statement.trim().to_string());
    }

    for stmt in statements {
        let s = stmt.trim();
        if s.is_empty() || s.starts_with("--") {
            continue;
        }

        let _ = sqlx::query(s).execute(&pool).await;
    }

    let count_sql = format!(
        "SELECT COUNT(*)::BIGINT FROM {t} WHERE user_id = $1 AND category = $2",
        t = tname
    );
    let count: i64 = sqlx::query_scalar(&count_sql)
        .bind(user_id)
        .bind("FOOD_AND_DRINK")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);

    let amt_sql = format!(
        "SELECT amount::TEXT FROM {t} WHERE user_id = $1 AND category = $2",
        t = tname
    );
    let amt_text: String = sqlx::query_scalar(&amt_sql)
        .bind(user_id)
        .bind("FOOD_AND_DRINK")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(amt_text.starts_with("300"));

    let has_month = month_column_exists(&pool, &tname).await.unwrap();
    assert!(!has_month);

    let drop_sql = format!("DROP TABLE IF EXISTS {}", tname);
    let _ = sqlx::query(&drop_sql).execute(&pool).await;
}

#[tokio::test]
async fn given_migration_applied_when_run_again_then_idempotent() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let tname = format!(
        "budgets_migtest_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    create_pre_migration_table(&pool, &tname).await.unwrap();

    let user_id = Uuid::new_v4();
    insert_budget(
        &pool,
        &tname,
        user_id,
        "GROCERIES",
        "2024-06",
        200.0,
        "2024-06-01T00:00:00Z",
    )
    .await
    .unwrap();
    insert_budget(
        &pool,
        &tname,
        user_id,
        "GROCERIES",
        "2024-07",
        220.0,
        "2024-07-01T00:00:00Z",
    )
    .await
    .unwrap();

    let sql = include_str!("../../migrations/010_budgets_monthless.sql");
    let adapted = adapt_migration_sql_for_table(sql, &tname);

    for _ in 0..2 {
        let mut statements = Vec::new();
        let mut current_statement = String::new();
        let mut paren_depth = 0;
        let mut in_string = false;
        let mut escape_next = false;

        for line in adapted.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("--") || trimmed.is_empty() {
                continue;
            }

            for c in line.chars() {
                if escape_next {
                    escape_next = false;
                    current_statement.push(c);
                    continue;
                }

                match c {
                    '\\' if in_string => escape_next = true,
                    '\'' => in_string = !in_string,
                    '(' if !in_string => paren_depth += 1,
                    ')' if !in_string => paren_depth -= 1,
                    ';' if !in_string && paren_depth == 0 => {
                        current_statement.push(c);
                        if !current_statement.trim().is_empty() {
                            statements.push(current_statement.trim().to_string());
                        }
                        current_statement.clear();
                        continue;
                    }
                    _ => {}
                }
                current_statement.push(c);
            }
            current_statement.push('\n');
        }

        if !current_statement.trim().is_empty() {
            statements.push(current_statement.trim().to_string());
        }

        for stmt in statements {
            let s = stmt.trim();
            if s.is_empty() || s.starts_with("--") {
                continue;
            }

            let _ = sqlx::query(s).execute(&pool).await;
        }
    }

    let count_sql = format!(
        "SELECT COUNT(*)::BIGINT FROM {t} WHERE user_id = $1 AND category = $2",
        t = tname
    );
    let count: i64 = sqlx::query_scalar(&count_sql)
        .bind(user_id)
        .bind("GROCERIES")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);

    // Cleanup
    let drop_sql = format!("DROP TABLE IF EXISTS {}", tname);
    let _ = sqlx::query(&drop_sql).execute(&pool).await;
}

#[tokio::test]
async fn given_post_migration_schema_when_inserting_duplicate_category_then_unique_violation() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let tname = format!(
        "budgets_migtest_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    create_pre_migration_table(&pool, &tname).await.unwrap();

    let user_id = Uuid::new_v4();
    insert_budget(
        &pool,
        &tname,
        user_id,
        "UTILITIES",
        "2024-05",
        150.0,
        "2024-05-01T00:00:00Z",
    )
    .await
    .unwrap();

    let sql = include_str!("../../migrations/010_budgets_monthless.sql");
    let adapted = adapt_migration_sql_for_table(sql, &tname);
    for stmt in adapted.split(';') {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        let stmt_sql = format!("{};", s);
        let _ = sqlx::query(&stmt_sql).execute(&pool).await;
    }

    let insert_sql = format!(
        "INSERT INTO {t} (id, user_id, category, amount, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())",
        t = tname
    );
    let res = sqlx::query(&insert_sql)
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind("UTILITIES")
        .bind(175.0)
        .execute(&pool)
        .await;

    match res {
        Ok(_) => panic!("Expected unique constraint violation, but insert succeeded"),
        Err(sqlx::Error::Database(db_err)) => {
            assert_eq!(db_err.code().as_deref(), Some("23505"));
        }
        Err(e) => panic!("Unexpected error: {}", e),
    }

    let drop_sql = format!("DROP TABLE IF EXISTS {}", tname);
    let _ = sqlx::query(&drop_sql).execute(&pool).await;
}

async fn create_test_accounts_table(pool: &PgPool, table: &str) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"CREATE TABLE IF NOT EXISTS {table} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_account_id VARCHAR UNIQUE,
            name VARCHAR NOT NULL,
            account_type VARCHAR NOT NULL,
            balance_current DECIMAL(12,2),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )"#
    );
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

async fn create_test_plaid_connections_table(
    pool: &PgPool,
    table: &str,
) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"CREATE TABLE IF NOT EXISTS {table} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL,
            item_id VARCHAR NOT NULL UNIQUE,
            is_connected BOOLEAN NOT NULL DEFAULT false,
            last_sync_at TIMESTAMPTZ,
            connected_at TIMESTAMPTZ DEFAULT NOW(),
            disconnected_at TIMESTAMPTZ,
            institution_name VARCHAR,
            transaction_count INTEGER DEFAULT 0,
            account_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )"#
    );
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

async fn column_exists(pool: &PgPool, table: &str, column: &str) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    )
    .bind(table)
    .bind(column)
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

fn adapt_bank_migration_sql_for_table(
    sql: &str,
    accounts_table: &str,
    connections_table: &str,
) -> String {
    let mut out = sql.replace(
        "ALTER TABLE accounts",
        &format!("ALTER TABLE {}", accounts_table),
    );
    out = out.replace(
        "ALTER TABLE plaid_connections",
        &format!("ALTER TABLE {}", connections_table),
    );

    out = out.replace(
        "idx_accounts_mask",
        &format!("idx_{}_mask", accounts_table.replace("test_", "")),
    );
    out = out.replace(
        "idx_accounts_subtype",
        &format!("idx_{}_subtype", accounts_table.replace("test_", "")),
    );
    out = out.replace(
        "idx_plaid_connections_sync_cursor",
        &format!("idx_{}_sync_cursor", connections_table.replace("test_", "")),
    );

    out = out.replace(" ON accounts(", &format!(" ON {}(", accounts_table));
    out = out.replace(
        " ON plaid_connections(",
        &format!(" ON {}(", connections_table),
    );

    let lines: Vec<&str> = out.split('\n').collect();
    let filtered_lines: Vec<&str> = lines
        .into_iter()
        .filter(|line| {
            !line.contains("ROW LEVEL SECURITY")
                && !line.contains("CREATE POLICY")
                && !line.contains("auth.uid()")
        })
        .collect();
    filtered_lines.join("\n")
}

#[tokio::test]
async fn given_pre_migration_schema_when_bank_operations_migration_runs_then_adds_new_columns() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let accounts_table = format!(
        "test_accounts_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    let connections_table = format!(
        "test_plaid_connections_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );

    create_test_accounts_table(&pool, &accounts_table)
        .await
        .unwrap();
    create_test_plaid_connections_table(&pool, &connections_table)
        .await
        .unwrap();

    let account_id = Uuid::new_v4();
    let connection_id = Uuid::new_v4();

    let insert_account_sql = format!(
        "INSERT INTO {} (id, provider_account_id, name, account_type, balance_current) VALUES ($1, $2, $3, $4, $5)",
        accounts_table
    );
    sqlx::query(&insert_account_sql)
        .bind(account_id)
        .bind("test_account_123")
        .bind("Test Checking")
        .bind("depository")
        .bind(1500.50)
        .execute(&pool)
        .await
        .unwrap();

    let insert_connection_sql = format!(
        "INSERT INTO {} (id, user_id, item_id, institution_name, is_connected) VALUES ($1, $2, $3, $4, $5)",
        connections_table
    );
    sqlx::query(&insert_connection_sql)
        .bind(connection_id)
        .bind("test_user_456")
        .bind("test_item_789")
        .bind("Test Bank")
        .bind(true)
        .execute(&pool)
        .await
        .unwrap();

    assert!(!column_exists(&pool, &accounts_table, "mask").await.unwrap());
    assert!(!column_exists(&pool, &accounts_table, "subtype")
        .await
        .unwrap());
    assert!(!column_exists(&pool, &accounts_table, "official_name")
        .await
        .unwrap());
    assert!(
        !column_exists(&pool, &connections_table, "institution_logo_url")
            .await
            .unwrap()
    );
    assert!(!column_exists(&pool, &connections_table, "sync_cursor")
        .await
        .unwrap());

    let sql = include_str!("../../migrations/011_enhance_bank_operations.sql");
    let adapted = adapt_bank_migration_sql_for_table(sql, &accounts_table, &connections_table);

    for stmt in adapted.split(';') {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        let stmt_sql = format!("{};", s);
        let _ = sqlx::query(&stmt_sql).execute(&pool).await;
    }

    assert!(column_exists(&pool, &accounts_table, "mask").await.unwrap());
    assert!(column_exists(&pool, &accounts_table, "subtype")
        .await
        .unwrap());
    assert!(column_exists(&pool, &accounts_table, "official_name")
        .await
        .unwrap());
    assert!(
        column_exists(&pool, &connections_table, "institution_logo_url")
            .await
            .unwrap()
    );
    assert!(column_exists(&pool, &connections_table, "sync_cursor")
        .await
        .unwrap());

    let account_check_sql = format!(
        "SELECT provider_account_id, name, account_type, balance_current FROM {} WHERE id = $1",
        accounts_table
    );
    let account_row = sqlx::query(&account_check_sql)
        .bind(account_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(
        account_row.get::<String, _>("provider_account_id"),
        "test_account_123"
    );
    assert_eq!(account_row.get::<String, _>("name"), "Test Checking");
    assert_eq!(account_row.get::<String, _>("account_type"), "depository");

    let connection_check_sql = format!(
        "SELECT user_id, item_id, institution_name FROM {} WHERE id = $1",
        connections_table
    );
    let connection_row = sqlx::query(&connection_check_sql)
        .bind(connection_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(connection_row.get::<String, _>("user_id"), "test_user_456");
    assert_eq!(connection_row.get::<String, _>("item_id"), "test_item_789");
    assert_eq!(
        connection_row.get::<String, _>("institution_name"),
        "Test Bank"
    );

    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", accounts_table))
        .execute(&pool)
        .await;
    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", connections_table))
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn given_bank_migration_when_run_twice_then_idempotent() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let accounts_table = format!(
        "test_accounts_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    let connections_table = format!(
        "test_plaid_connections_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );

    create_test_accounts_table(&pool, &accounts_table)
        .await
        .unwrap();
    create_test_plaid_connections_table(&pool, &connections_table)
        .await
        .unwrap();

    let sql = include_str!("../../migrations/011_enhance_bank_operations.sql");
    let adapted = adapt_bank_migration_sql_for_table(sql, &accounts_table, &connections_table);

    for _ in 0..2 {
        for stmt in adapted.split(';') {
            let s = stmt.trim();
            if s.is_empty() {
                continue;
            }
            let stmt_sql = format!("{};", s);
            let _ = sqlx::query(&stmt_sql).execute(&pool).await;
        }
    }

    assert!(column_exists(&pool, &accounts_table, "mask").await.unwrap());
    assert!(column_exists(&pool, &accounts_table, "subtype")
        .await
        .unwrap());
    assert!(column_exists(&pool, &accounts_table, "official_name")
        .await
        .unwrap());
    assert!(
        column_exists(&pool, &connections_table, "institution_logo_url")
            .await
            .unwrap()
    );
    assert!(column_exists(&pool, &connections_table, "sync_cursor")
        .await
        .unwrap());

    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", accounts_table))
        .execute(&pool)
        .await;
    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", connections_table))
        .execute(&pool)
        .await;
}

#[tokio::test]
async fn given_post_migration_schema_when_inserting_new_fields_then_succeeds() {
    let Some(pool) = connect_pool().await else {
        return;
    };

    let accounts_table = format!(
        "test_accounts_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );
    let connections_table = format!(
        "test_plaid_connections_{}",
        &Uuid::new_v4().to_string().replace('-', "")[..8]
    );

    create_test_accounts_table(&pool, &accounts_table)
        .await
        .unwrap();
    create_test_plaid_connections_table(&pool, &connections_table)
        .await
        .unwrap();

    let sql = include_str!("../../migrations/011_enhance_bank_operations.sql");
    let adapted = adapt_bank_migration_sql_for_table(sql, &accounts_table, &connections_table);

    for stmt in adapted.split(';') {
        let s = stmt.trim();
        if s.is_empty() {
            continue;
        }
        let stmt_sql = format!("{};", s);
        let _ = sqlx::query(&stmt_sql).execute(&pool).await;
    }

    let account_id = Uuid::new_v4();
    let insert_account_sql = format!(
        "INSERT INTO {} (id, provider_account_id, name, account_type, balance_current, mask, subtype, official_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        accounts_table
    );
    sqlx::query(&insert_account_sql)
        .bind(account_id)
        .bind("test_plaid_123")
        .bind("My Checking Account")
        .bind("depository")
        .bind(2500.75)
        .bind("1234")
        .bind("checking")
        .bind("Chase Total Checking®")
        .execute(&pool)
        .await
        .unwrap();

    let connection_id = Uuid::new_v4();
    let insert_connection_sql = format!(
        "INSERT INTO {} (id, user_id, item_id, institution_name, is_connected, institution_logo_url, sync_cursor) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        connections_table
    );
    sqlx::query(&insert_connection_sql)
        .bind(connection_id)
        .bind("user_789")
        .bind("item_456")
        .bind("Chase")
        .bind(true)
        .bind("https://plaid.com/logos/chase.png")
        .bind("sync_cursor_abc123")
        .execute(&pool)
        .await
        .unwrap();

    let account_check_sql = format!(
        "SELECT mask, subtype, official_name FROM {} WHERE id = $1",
        accounts_table
    );
    let account_row = sqlx::query(&account_check_sql)
        .bind(account_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(
        account_row.get::<Option<String>, _>("mask"),
        Some("1234".to_string())
    );
    assert_eq!(
        account_row.get::<Option<String>, _>("subtype"),
        Some("checking".to_string())
    );
    assert_eq!(
        account_row.get::<Option<String>, _>("official_name"),
        Some("Chase Total Checking®".to_string())
    );

    let connection_check_sql = format!(
        "SELECT institution_logo_url, sync_cursor FROM {} WHERE id = $1",
        connections_table
    );
    let connection_row = sqlx::query(&connection_check_sql)
        .bind(connection_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(
        connection_row.get::<Option<String>, _>("institution_logo_url"),
        Some("https://plaid.com/logos/chase.png".to_string())
    );
    assert_eq!(
        connection_row.get::<Option<String>, _>("sync_cursor"),
        Some("sync_cursor_abc123".to_string())
    );

    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", accounts_table))
        .execute(&pool)
        .await;
    let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {}", connections_table))
        .execute(&pool)
        .await;
}
