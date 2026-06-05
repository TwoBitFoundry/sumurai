use crate::models::account::Account;
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::models::transaction::Transaction;
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::repository_service::DatabaseRepository;
use crate::services::{AuthService, CacheService};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

pub const DEMO_EMAIL: &str = "me@test.com";
const DEMO_PASSWORD: &str = "Test1234!";
pub const SUMURAI_DEMO_ORG_CONN_ID: &str = "sumurai_demo";

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

    let existing = db
        .get_all_provider_connections_by_user(&user_id)
        .await
        .unwrap_or_default();

    if existing.iter().any(|c| c.item_id == item_id) {
        tracing::info!("Demo SimpleFin data already present, skipping");
        return Ok(());
    }

    let now = Utc::now();
    let connection = ProviderConnection {
        id: Uuid::new_v4(),
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

    let connection_id = db
        .save_provider_connection(&connection)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to save demo provider connection: {}", e))?;

    let checking_id = Uuid::new_v4();
    let savings_id = Uuid::new_v4();
    let credit_id = Uuid::new_v4();
    let investment_id = Uuid::new_v4();
    let loan_id = Uuid::new_v4();

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

    for account in &accounts {
        db.upsert_account(account)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to upsert demo account: {}", e))?;
    }

    let seed_date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();

    let raw_txns: &[(&str, Uuid, &str, &str)] = &[
        (
            "sumurai_demo_txn_01",
            checking_id,
            "SQ *BLUE BOTTLE COFFEE",
            "-4.75",
        ),
        (
            "sumurai_demo_txn_02",
            checking_id,
            "PAYROLL DIRECT DEPOSIT SUMURAI INC",
            "2500.00",
        ),
        (
            "sumurai_demo_txn_03",
            checking_id,
            "CHECK # 1042 PAID",
            "-150.00",
        ),
        (
            "sumurai_demo_txn_04",
            checking_id,
            "ATM WITHDRAWAL 123 MAIN ST",
            "-60.00",
        ),
        (
            "sumurai_demo_txn_05",
            checking_id,
            "ZELLE PAYMENT TO ALEX SMITH",
            "-75.00",
        ),
        (
            "sumurai_demo_txn_06",
            checking_id,
            "NETFLIX.COM 866-579-7172 CA",
            "-15.49",
        ),
        (
            "sumurai_demo_txn_07",
            checking_id,
            "COSTCO WHSE #573 PORTLAND OR 06/01",
            "-127.83",
        ),
        (
            "sumurai_demo_txn_08",
            checking_id,
            "POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03",
            "-6.45",
        ),
        (
            "sumurai_demo_txn_09",
            checking_id,
            "WALMART SUPERCENTER 4321 06/04",
            "-89.23",
        ),
        (
            "sumurai_demo_txn_10",
            checking_id,
            "TARGET STORE #1234 PORTLAND OR",
            "-43.12",
        ),
        (
            "sumurai_demo_txn_11",
            checking_id,
            "AMAZON.COM LLC",
            "-34.99",
        ),
        (
            "sumurai_demo_txn_12",
            checking_id,
            "AMZN MKTP US*1A2B3C4D",
            "-22.50",
        ),
        (
            "sumurai_demo_txn_13",
            checking_id,
            "SHELL OIL 59401234 DEBIT PURCHASE",
            "-52.00",
        ),
        (
            "sumurai_demo_txn_14",
            checking_id,
            "UBER* TRIPS HELP.UBER.COM CA",
            "-18.75",
        ),
        (
            "sumurai_demo_txn_15",
            checking_id,
            "RANDOMCO MERCHANT PORTLAND OR 12345",
            "-29.99",
        ),
        (
            "sumurai_demo_txn_16",
            credit_id,
            "WHOLEFDS MKT #10452 PORTLAND OR",
            "-67.43",
        ),
        (
            "sumurai_demo_txn_17",
            savings_id,
            "ONLINE TRANSFER TO CHECKING",
            "-200.00",
        ),
        (
            "sumurai_demo_txn_18",
            investment_id,
            "DIVIDEND REINVESTMENT VANGUARD",
            "12.50",
        ),
        (
            "sumurai_demo_txn_19",
            loan_id,
            "AUTOPAY LOAN PAYMENT",
            "-348.00",
        ),
    ];

    let mut transactions: Vec<Transaction> = raw_txns
        .iter()
        .map(|(txn_id, account_id, raw_desc, amount_str)| Transaction {
            id: Uuid::new_v4(),
            account_id: *account_id,
            user_id: Some(user_id),
            provider_account_id: None,
            provider_transaction_id: Some(txn_id.to_string()),
            amount: Decimal::from_str(amount_str).unwrap(),
            date: seed_date,
            merchant_name: Some(raw_desc.to_string()),
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: String::new(),
            payment_channel: None,
            pending: false,
            created_at: Some(now),
            original_merchant_name: Some(raw_desc.to_string()),
            normalized_merchant: None,
        })
        .collect();

    let normalization_service =
        MerchantNormalizationService::new(Arc::clone(db), Arc::clone(cache_service));
    if let Err(e) = normalization_service
        .normalize_batch(&mut transactions)
        .await
    {
        tracing::warn!("Demo seed normalization failed: {}", e);
    }

    db.upsert_transactions_batch(&transactions, &user_id)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to seed demo transactions: {}", e))?;

    tracing::info!("Demo SimpleFin data seeded for me@test.com");
    Ok(())
}
