use crate::models::account::Account;
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::models::transaction::Transaction;
use crate::services::categorization::classifier_labels::apply_deterministic_categories;
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::repository_service::DatabaseRepository;
use crate::services::{AuthService, CacheService};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

pub const DEMO_EMAIL: &str = "me@test.com";
const DEMO_PASSWORD: &str = "Test1234!";
pub const SUMURAI_DEMO_ORG_CONN_ID: &str = "sumurai_demo";

pub const DEMO_SIMPLEFIN_PROVIDER_TXN_IDS: [&str; 26] = [
    "sumurai_demo_txn_01",
    "sumurai_demo_txn_02",
    "sumurai_demo_txn_03",
    "sumurai_demo_txn_04",
    "sumurai_demo_txn_05",
    "sumurai_demo_txn_06",
    "sumurai_demo_txn_07",
    "sumurai_demo_txn_08",
    "sumurai_demo_txn_09",
    "sumurai_demo_txn_10",
    "sumurai_demo_txn_11",
    "sumurai_demo_txn_12",
    "sumurai_demo_txn_13",
    "sumurai_demo_txn_14",
    "sumurai_demo_txn_15",
    "sumurai_demo_txn_16",
    "sumurai_demo_txn_17",
    "sumurai_demo_txn_18",
    "sumurai_demo_txn_19",
    "sumurai_demo_gym_01",
    "sumurai_demo_gym_02",
    "sumurai_demo_gym_03",
    "sumurai_demo_gym_04",
    "sumurai_demo_excl_01",
    "sumurai_demo_excl_02",
    "sumurai_demo_excl_03",
];

fn demo_seed_hash(user_id: Uuid, key: &str, salt: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    salt.hash(&mut hasher);
    user_id.hash(&mut hasher);
    key.hash(&mut hasher);
    hasher.finish()
}

pub fn demo_entity_id(user_id: Uuid, key: &str) -> Uuid {
    let high = demo_seed_hash(user_id, key, "sumurai-demo-seed-high");
    let low = demo_seed_hash(user_id, key, "sumurai-demo-seed-low");
    Uuid::from_fields(
        (high >> 32) as u32,
        (high >> 16) as u16,
        high as u16,
        &[
            (low >> 56) as u8,
            (low >> 48) as u8,
            (low >> 40) as u8,
            (low >> 32) as u8,
            (low >> 24) as u8,
            (low >> 16) as u8,
            (low >> 8) as u8,
            low as u8,
        ],
    )
}

pub fn is_demo_simplefin_seeded(provider_txn_ids: &[String]) -> bool {
    DEMO_SIMPLEFIN_PROVIDER_TXN_IDS
        .iter()
        .all(|expected| provider_txn_ids.iter().any(|id| id == expected))
}

pub async fn maybe_seed_demo_user(
    db: &Arc<dyn DatabaseRepository>,
    auth: &Arc<AuthService>,
) -> anyhow::Result<()> {
    if !std::env::var("SEED_DEMO_USER")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return Ok(());
    }

    match db.get_user_by_email(DEMO_EMAIL).await {
        Ok(Some(_)) => {
            tracing::debug!("Demo user {} already exists, skipping seed", DEMO_EMAIL);
            return Ok(());
        }
        Ok(None) => {}
        Err(e) => {
            tracing::warn!("Could not check for demo user: {}", e);
            return Ok(());
        }
    }

    let password_hash = auth
        .hash_password(DEMO_PASSWORD)
        .map_err(|e| anyhow::anyhow!("Failed to hash demo password: {}", e))?;

    let user = User {
        id: Uuid::new_v4(),
        email: DEMO_EMAIL.to_string(),
        password_hash: Some(password_hash),
        provider: String::new(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        onboarding_completed: true,
    };

    if let Err(e) = db.create_user(&user).await {
        tracing::warn!("Failed to seed demo user: {}", e);
        return Ok(());
    }

    tracing::info!("Demo user {} seeded (password login enabled)", DEMO_EMAIL);
    Ok(())
}

pub async fn maybe_seed_demo_simplefin_data(
    db: &Arc<dyn DatabaseRepository>,
    cache_service: &Arc<dyn CacheService>,
) -> anyhow::Result<()> {
    if !std::env::var("SEED_DEMO_USER")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return Ok(());
    }

    let user = match db.get_user_by_email(DEMO_EMAIL).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            tracing::warn!(
                "Demo user {} not found, skipping SimpleFin seed",
                DEMO_EMAIL
            );
            return Ok(());
        }
        Err(e) => {
            tracing::warn!("Could not look up demo user for SimpleFin seed: {}", e);
            return Ok(());
        }
    };

    let user_id = user.id;
    let item_id = format!("simplefin_{}_sumurai_demo", user_id);

    let provider_txn_ids = db
        .get_provider_transaction_ids_for_user(&user_id)
        .await
        .unwrap_or_default();

    if is_demo_simplefin_seeded(&provider_txn_ids) {
        backfill_demo_transaction_categories(db, &user_id).await?;
        tracing::info!("Demo SimpleFin data already present, refreshed demo categories");
        return Ok(());
    }

    let now = Utc::now();
    let connection_id = demo_entity_id(user_id, "connection:sumurai_demo");
    let checking_id = demo_entity_id(user_id, "account:sumurai_demo_dep_checking");
    let savings_id = demo_entity_id(user_id, "account:sumurai_demo_dep_savings");
    let credit_id = demo_entity_id(user_id, "account:sumurai_demo_credit");
    let investment_id = demo_entity_id(user_id, "account:sumurai_demo_investment");
    let loan_id = demo_entity_id(user_id, "account:sumurai_demo_loan");

    let connection = ProviderConnection {
        id: connection_id,
        user_id,
        item_id: item_id.clone(),
        provider: "simplefin".to_string(),
        is_connected: true,
        last_sync_at: None,
        connected_at: Some(now),
        disconnected_at: None,
        institution_id: Some(SUMURAI_DEMO_ORG_CONN_ID.to_string()),
        institution_name: Some("Sumurai Demo Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 0,
        account_count: 5,
        created_at: Some(now),
        updated_at: Some(now),
    };

    let accounts = [
        Account {
            id: checking_id,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_dep_checking".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Checking (1001)".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::from_str("5000.00").unwrap()),
            mask: Some("1001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: savings_id,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_dep_savings".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Savings (2001)".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(Decimal::from_str("12000.00").unwrap()),
            mask: Some("2001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: credit_id,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_credit".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Credit Card (3001)".to_string(),
            account_type: "credit".to_string(),
            balance_current: Some(Decimal::from_str("-1234.56").unwrap()),
            mask: Some("3001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: investment_id,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_investment".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Brokerage IRA (4001)".to_string(),
            account_type: "investment".to_string(),
            balance_current: Some(Decimal::from_str("45000.00").unwrap()),
            mask: Some("4001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: loan_id,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_loan".to_string()),
            provider_connection_id: Some(connection_id),
            name: "Sumurai Auto Loan (5001)".to_string(),
            account_type: "loan".to_string(),
            balance_current: Some(Decimal::from_str("-18500.00").unwrap()),
            mask: Some("5001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
    ];

    let seed_date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let d = |y, m, day| NaiveDate::from_ymd_opt(y, m, day).unwrap();

    let raw_txns: &[(&str, Uuid, &str, &str, NaiveDate)] = &[
        (
            "sumurai_demo_txn_01",
            checking_id,
            "SQ *BLUE BOTTLE COFFEE",
            "-4.75",
            seed_date,
        ),
        (
            "sumurai_demo_txn_02",
            checking_id,
            "PAYROLL DIRECT DEPOSIT SUMURAI INC",
            "2500.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_03",
            checking_id,
            "CHECK # 1042 PAID",
            "-150.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_04",
            checking_id,
            "ATM WITHDRAWAL 123 MAIN ST",
            "-60.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_05",
            checking_id,
            "ZELLE PAYMENT TO ALEX SMITH",
            "-75.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_06",
            checking_id,
            "NETFLIX.COM 866-579-7172 CA",
            "-15.49",
            seed_date,
        ),
        (
            "sumurai_demo_txn_07",
            checking_id,
            "COSTCO WHSE #573 PORTLAND OR 06/01",
            "-127.83",
            seed_date,
        ),
        (
            "sumurai_demo_txn_08",
            checking_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03",
            "-6.45",
            seed_date,
        ),
        (
            "sumurai_demo_txn_09",
            checking_id,
            "WALMART SUPERCENTER 4321 06/04",
            "-89.23",
            seed_date,
        ),
        (
            "sumurai_demo_txn_10",
            checking_id,
            "TARGET STORE #1234 PORTLAND OR",
            "-43.12",
            seed_date,
        ),
        (
            "sumurai_demo_txn_11",
            checking_id,
            "AMAZON.COM LLC",
            "-34.99",
            seed_date,
        ),
        (
            "sumurai_demo_txn_12",
            checking_id,
            "AMZN MKTP US*1A2B3C4D",
            "-22.50",
            seed_date,
        ),
        (
            "sumurai_demo_txn_13",
            checking_id,
            "SHELL OIL 59401234 DEBIT PURCHASE",
            "-52.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_14",
            checking_id,
            "UBER* TRIPS HELP.UBER.COM CA",
            "-18.75",
            seed_date,
        ),
        (
            "sumurai_demo_txn_15",
            checking_id,
            "RANDOMCO MERCHANT PORTLAND OR 12345",
            "-29.99",
            seed_date,
        ),
        (
            "sumurai_demo_txn_16",
            credit_id,
            "WHOLEFDS MKT #10452 PORTLAND OR",
            "-67.43",
            seed_date,
        ),
        (
            "sumurai_demo_txn_17",
            savings_id,
            "ONLINE TRANSFER TO CHECKING",
            "-200.00",
            seed_date,
        ),
        (
            "sumurai_demo_txn_18",
            investment_id,
            "DIVIDEND REINVESTMENT VANGUARD",
            "12.50",
            seed_date,
        ),
        (
            "sumurai_demo_txn_19",
            loan_id,
            "AUTOPAY LOAN PAYMENT",
            "-348.00",
            seed_date,
        ),
        (
            "sumurai_demo_gym_01",
            checking_id,
            "PDXFIT GYM PORTLAND OR MONTHLY",
            "-29.99",
            d(2026, 2, 15),
        ),
        (
            "sumurai_demo_gym_02",
            checking_id,
            "PDXFIT GYM PORTLAND OR MONTHLY",
            "-29.99",
            d(2026, 3, 15),
        ),
        (
            "sumurai_demo_gym_03",
            checking_id,
            "PDXFIT GYM PORTLAND OR MONTHLY",
            "-29.99",
            d(2026, 4, 15),
        ),
        (
            "sumurai_demo_gym_04",
            checking_id,
            "PDXFIT GYM PORTLAND OR MONTHLY",
            "-29.99",
            d(2026, 5, 15),
        ),
        (
            "sumurai_demo_excl_01",
            checking_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA",
            "-6.45",
            d(2026, 3, 10),
        ),
        (
            "sumurai_demo_excl_02",
            checking_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA",
            "-6.45",
            d(2026, 4, 10),
        ),
        (
            "sumurai_demo_excl_03",
            checking_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA",
            "-6.45",
            d(2026, 5, 10),
        ),
    ];

    let mut transactions: Vec<Transaction> = raw_txns
        .iter()
        .map(
            |(txn_id, account_id, raw_desc, amount_str, txn_date)| Transaction {
                id: demo_entity_id(user_id, &format!("txn:{txn_id}")),
                account_id: *account_id,
                user_id: Some(user_id),
                provider_account_id: None,
                provider_transaction_id: Some(txn_id.to_string()),
                amount: Decimal::from_str(amount_str).unwrap(),
                date: *txn_date,
                merchant_name: Some(raw_desc.to_string()),
                category_primary: "OTHER".to_string(),
                category_detailed: "OTHER".to_string(),
                category_confidence: String::new(),
                payment_channel: None,
                pending: false,
                created_at: Some(now),
                original_merchant_name: Some(raw_desc.to_string()),
                normalized_merchant: None,
                normalization_source: None,
            },
        )
        .collect();

    let normalization_service =
        MerchantNormalizationService::new(Arc::clone(db), Arc::clone(cache_service));
    normalization_service
        .normalize_batch(&mut transactions)
        .await
        .map_err(|e| anyhow::anyhow!("Demo seed normalization failed: {}", e))?;
    apply_deterministic_categories(&mut transactions);

    db.upsert_provider_snapshot_bundle(&user_id, &connection, &accounts, &transactions)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to seed demo SimpleFin snapshot: {}", e))?;

    tracing::info!("Demo SimpleFin data seeded for me@test.com");
    Ok(())
}

async fn backfill_demo_transaction_categories(
    db: &Arc<dyn DatabaseRepository>,
    user_id: &Uuid,
) -> anyhow::Result<()> {
    let demo_ids: HashSet<&str> = DEMO_SIMPLEFIN_PROVIDER_TXN_IDS.iter().copied().collect();
    let mut transactions = db.get_transactions_for_user(user_id).await.map_err(|e| {
        anyhow::anyhow!(
            "Failed to load demo transactions for category backfill: {}",
            e
        )
    })?;
    transactions.retain(|transaction| {
        transaction
            .provider_transaction_id
            .as_deref()
            .is_some_and(|id| demo_ids.contains(id))
    });
    if transactions.is_empty() {
        return Ok(());
    }
    apply_deterministic_categories(&mut transactions);
    db.upsert_transactions_batch(&transactions, user_id)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to backfill demo transaction categories: {}", e))?;
    Ok(())
}
