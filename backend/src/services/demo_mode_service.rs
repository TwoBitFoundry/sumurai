use crate::models::account::Account;
use crate::models::auth::User;
use crate::models::plaid::ProviderConnection;
use crate::models::transaction::Transaction;
use crate::seed;
use crate::services::budget_service::BudgetService;
use crate::services::categorization::category_descriptors::SYSTEM_CATEGORY_SLUGS;
use crate::services::connection_service::ConnectionService;
use crate::services::merchant_normalization::service::MerchantNormalizationService;
use crate::services::repository_service::DatabaseRepository;
use crate::services::CacheService;
use anyhow::Result;
use chrono::{Duration, Months, NaiveDate, Utc};
use rust_decimal::Decimal;
use std::collections::BTreeSet;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

const SIMPLEFIN_CONNECTION_KEY: &str = "connection:sumurai_demo";
const SIMPLEFIN_ITEM_KEY: &str = "simplefin_sumurai_demo";
const DIY_CONNECTION_KEY: &str = "connection:sumurai_demo_diy";
const DIY_ITEM_KEY: &str = "diy_sumurai_demo";
const DIY_INSTITUTION_NAME: &str = "Sumurai Demo DIY";
const MIN_BUDGET_AMOUNT: &str = "50.00";

struct SyncedAccountIds {
    checking: Uuid,
    savings: Uuid,
    credit: Uuid,
    investment: Uuid,
    loan: Uuid,
}

struct AuthoredTransaction {
    provider_transaction_id: String,
    account_id: Uuid,
    amount: Decimal,
    date: NaiveDate,
    raw_merchant: String,
    category_primary: String,
    payment_channel: Option<String>,
}

pub struct DemoModeService;

impl DemoModeService {
    pub async fn seed_demo_workspace_for_user(
        db: &Arc<dyn DatabaseRepository>,
        cache_service: &Arc<dyn CacheService>,
        user: &User,
    ) -> Result<()> {
        Self::activate_demo_workspace_for_user(db, cache_service, user, false).await
    }

    pub async fn activate_demo_workspace_for_user(
        db: &Arc<dyn DatabaseRepository>,
        cache_service: &Arc<dyn CacheService>,
        user: &User,
        mark_onboarding_complete: bool,
    ) -> Result<()> {
        let user_id = user.id;
        let now = Utc::now();
        let normalization_service =
            MerchantNormalizationService::new(Arc::clone(db), Arc::clone(cache_service));

        let synced_accounts = synced_account_ids(user_id);
        let simplefin_connection = build_simplefin_connection(user_id, now);
        let synced_account_rows =
            build_simplefin_accounts(user_id, &simplefin_connection, &synced_accounts);
        let mut authored_transactions = build_authored_transactions(&synced_accounts);
        let offset_days = runtime_offset_days(Utc::now().date_naive());
        apply_runtime_offset(&mut authored_transactions, offset_days);
        let transactions =
            to_transactions(user_id, now, &authored_transactions, &normalization_service).await?;

        ensure_category_coverage(&transactions)?;
        ensure_transaction_contract(&transactions)?;

        let mut connection = simplefin_connection.clone();
        connection.transaction_count = transactions.len() as i32;
        connection.account_count = synced_account_rows.len() as i32;
        db.upsert_provider_snapshot_bundle(
            &user_id,
            &connection,
            &synced_account_rows,
            &transactions,
        )
        .await?;

        let diy_connection = build_diy_connection(user_id, now);
        let diy_connection_id = db.save_provider_connection(&diy_connection).await?;
        let diy_accounts = build_diy_accounts(user_id, diy_connection_id);
        for account in &diy_accounts {
            db.upsert_account(account).await?;
        }

        seed_budgets(db, user_id, &transactions).await?;
        db.update_user_provider(&user_id, "simplefin").await?;

        if mark_onboarding_complete {
            db.mark_onboarding_complete(&user_id).await?;
        }

        Ok(())
    }

    pub async fn exit_demo_mode_if_active(
        db: &Arc<dyn DatabaseRepository>,
        cache_service: &Arc<dyn CacheService>,
        connection_service: &ConnectionService,
        user_id: &Uuid,
        jwt_id: &str,
    ) -> Result<bool> {
        let Some(user) = db.get_user_by_id(user_id).await? else {
            return Ok(false);
        };

        if !user.demo_mode_active {
            return Ok(false);
        }

        let connections = db.get_all_provider_connections_by_user(user_id).await?;
        for connection in connections {
            connection_service
                .disconnect_connection_by_id(&connection.id, user_id, jwt_id)
                .await?;
        }

        let budgets = db.get_budgets_for_user(*user_id).await?;
        for budget in budgets {
            db.delete_budget_for_user(budget.id, *user_id).await?;
        }

        let custom_categories = db.list_custom_categories_for_user(user_id).await?;
        for category in custom_categories {
            db.delete_custom_category(user_id, &category.id).await?;
        }

        db.delete_all_transaction_category_overrides_for_user(user_id)
            .await?;

        let hidden_orgs = db.list_simplefin_hidden_orgs(user_id).await?;
        for org_conn_id in hidden_orgs {
            db.remove_simplefin_hidden_org(user_id, &org_conn_id)
                .await?;
        }

        db.delete_simplefin_root_credential(user_id).await?;
        db.set_demo_mode_active(user_id, false).await?;

        if let Err(error) = cache_service
            .invalidate_pattern(&format!("{}_*", jwt_id))
            .await
        {
            tracing::warn!(
                "Failed to invalidate cache after demo mode exit for user {}: {}",
                user_id,
                error
            );
        }

        Ok(true)
    }
}

pub(crate) fn runtime_offset_days(current_date: NaiveDate) -> i64 {
    let authored_latest = authored_latest_transaction_date();
    (current_date - authored_latest).num_days().max(0)
}

fn authored_latest_transaction_date() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 6, 27).unwrap()
}

fn synced_account_ids(user_id: Uuid) -> SyncedAccountIds {
    SyncedAccountIds {
        checking: seed::demo_entity_id(user_id, "account:sumurai_demo_dep_checking"),
        savings: seed::demo_entity_id(user_id, "account:sumurai_demo_dep_savings"),
        credit: seed::demo_entity_id(user_id, "account:sumurai_demo_credit"),
        investment: seed::demo_entity_id(user_id, "account:sumurai_demo_investment"),
        loan: seed::demo_entity_id(user_id, "account:sumurai_demo_loan"),
    }
}

fn build_simplefin_connection(user_id: Uuid, now: chrono::DateTime<Utc>) -> ProviderConnection {
    ProviderConnection {
        id: seed::demo_entity_id(user_id, SIMPLEFIN_CONNECTION_KEY),
        user_id,
        item_id: format!("simplefin_{user_id}_{SIMPLEFIN_ITEM_KEY}"),
        provider: "simplefin".to_string(),
        is_connected: true,
        last_sync_at: Some(now),
        connected_at: Some(now),
        disconnected_at: None,
        institution_id: Some(seed::SUMURAI_DEMO_ORG_CONN_ID.to_string()),
        institution_name: Some("Sumurai Demo Bank".to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 0,
        account_count: 0,
        created_at: Some(now),
        updated_at: Some(now),
    }
}

fn build_simplefin_accounts(
    user_id: Uuid,
    connection: &ProviderConnection,
    ids: &SyncedAccountIds,
) -> Vec<Account> {
    let item_id = connection.item_id.clone();
    vec![
        Account {
            id: ids.checking,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_dep_checking".to_string()),
            provider_connection_id: Some(connection.id),
            name: "Sumurai Checking (1001)".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(decimal("6480.42")),
            mask: Some("1001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: ids.savings,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_dep_savings".to_string()),
            provider_connection_id: Some(connection.id),
            name: "Sumurai Savings (2001)".to_string(),
            account_type: "depository".to_string(),
            balance_current: Some(decimal("18220.00")),
            mask: Some("2001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: ids.credit,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_credit".to_string()),
            provider_connection_id: Some(connection.id),
            name: "Sumurai Credit Card (3001)".to_string(),
            account_type: "credit".to_string(),
            balance_current: Some(decimal("-1438.24")),
            mask: Some("3001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: ids.investment,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_investment".to_string()),
            provider_connection_id: Some(connection.id),
            name: "Sumurai Brokerage IRA (4001)".to_string(),
            account_type: "investment".to_string(),
            balance_current: Some(decimal("47215.89")),
            mask: Some("4001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id.clone()),
        },
        Account {
            id: ids.loan,
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_loan".to_string()),
            provider_connection_id: Some(connection.id),
            name: "Sumurai Auto Loan (5001)".to_string(),
            account_type: "loan".to_string(),
            balance_current: Some(decimal("-18420.77")),
            mask: Some("5001".to_string()),
            institution_name: Some("Sumurai Demo Bank".to_string()),
            provider_conn_id: Some(item_id),
        },
    ]
}

fn build_diy_connection(user_id: Uuid, now: chrono::DateTime<Utc>) -> ProviderConnection {
    ProviderConnection {
        id: seed::demo_entity_id(user_id, DIY_CONNECTION_KEY),
        user_id,
        item_id: format!("diy_{user_id}_{DIY_ITEM_KEY}"),
        provider: "diy".to_string(),
        is_connected: true,
        last_sync_at: None,
        connected_at: Some(now),
        disconnected_at: None,
        institution_id: Some("diy_demo".to_string()),
        institution_name: Some(DIY_INSTITUTION_NAME.to_string()),
        institution_logo_url: None,
        sync_cursor: None,
        transaction_count: 0,
        account_count: 2,
        created_at: Some(now),
        updated_at: Some(now),
    }
}

fn build_diy_accounts(user_id: Uuid, connection_id: Uuid) -> Vec<Account> {
    vec![
        Account {
            id: seed::demo_entity_id(user_id, "account:sumurai_demo_diy_cash"),
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_diy_cash".to_string()),
            provider_connection_id: Some(connection_id),
            name: "DIY Cash Envelope".to_string(),
            account_type: "cash".to_string(),
            balance_current: Some(decimal("420.00")),
            mask: Some("D101".to_string()),
            institution_name: Some(DIY_INSTITUTION_NAME.to_string()),
            provider_conn_id: None,
        },
        Account {
            id: seed::demo_entity_id(user_id, "account:sumurai_demo_diy_travel"),
            user_id: Some(user_id),
            provider_account_id: Some("sumurai_demo_diy_travel".to_string()),
            provider_connection_id: Some(connection_id),
            name: "DIY Travel Fund".to_string(),
            account_type: "savings".to_string(),
            balance_current: Some(decimal("1650.00")),
            mask: Some("D202".to_string()),
            institution_name: Some(DIY_INSTITUTION_NAME.to_string()),
            provider_conn_id: None,
        },
    ]
}

fn build_authored_transactions(ids: &SyncedAccountIds) -> Vec<AuthoredTransaction> {
    let mut transactions = Vec::new();
    let authored_latest = authored_latest_transaction_date();
    let month_starts = authored_month_starts();

    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[0].to_string(),
        ids.checking,
        "SQ *BLUE BOTTLE COFFEE",
        "-4.75",
        authored_latest,
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[1].to_string(),
        ids.checking,
        "PAYROLL DIRECT DEPOSIT SUMURAI INC",
        "2500.00",
        authored_latest,
        "INCOME",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[2].to_string(),
        ids.checking,
        "CHECK # 1042 PAID",
        "-150.00",
        authored_latest,
        "GENERAL_SERVICES",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[3].to_string(),
        ids.checking,
        "ATM WITHDRAWAL 123 MAIN ST",
        "-60.00",
        authored_latest,
        "BANK_FEES",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[4].to_string(),
        ids.checking,
        "ZELLE PAYMENT TO ALEX SMITH",
        "-75.00",
        authored_latest,
        "OTHER",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[5].to_string(),
        ids.checking,
        "NETFLIX.COM 866-579-7172 CA",
        "-15.49",
        authored_latest,
        "SUBSCRIPTION",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[6].to_string(),
        ids.checking,
        "COSTCO WHSE #573 PORTLAND OR 06/01",
        "-127.83",
        authored_latest,
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[7].to_string(),
        ids.checking,
        "POS DEBIT STARBUCKS #12345 SEATTLE WA 06/03",
        "-6.45",
        authored_latest,
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[8].to_string(),
        ids.checking,
        "WALMART SUPERCENTER 4321 06/04",
        "-89.23",
        authored_latest,
        "SHOPPING",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[9].to_string(),
        ids.checking,
        "TARGET STORE #1234 PORTLAND OR",
        "-43.12",
        authored_latest,
        "SHOPPING",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[10].to_string(),
        ids.checking,
        "AMAZON.COM LLC",
        "-34.99",
        authored_latest,
        "GENERAL_MERCHANDISE",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[11].to_string(),
        ids.checking,
        "AMZN MKTP US*1A2B3C4D",
        "-22.50",
        authored_latest,
        "GENERAL_MERCHANDISE",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[12].to_string(),
        ids.checking,
        "SHELL OIL 59401234 DEBIT PURCHASE",
        "-52.00",
        authored_latest,
        "TRANSPORTATION",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[13].to_string(),
        ids.checking,
        "UBER* TRIPS HELP.UBER.COM CA",
        "-18.75",
        authored_latest,
        "TRANSPORTATION",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[14].to_string(),
        ids.checking,
        "RANDOMCO MERCHANT PORTLAND OR 12345",
        "-29.99",
        authored_latest,
        "OTHER",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[15].to_string(),
        ids.credit,
        "WHOLEFDS MKT #10452 PORTLAND OR",
        "-67.43",
        authored_latest,
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[16].to_string(),
        ids.savings,
        "ONLINE TRANSFER TO CHECKING",
        "-200.00",
        authored_latest,
        "TRANSFER_OUT",
        Some("online"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[17].to_string(),
        ids.investment,
        "DIVIDEND REINVESTMENT VANGUARD",
        "12.50",
        authored_latest,
        "INCOME",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[18].to_string(),
        ids.loan,
        "AUTOPAY LOAN PAYMENT",
        "-348.00",
        authored_latest,
        "LOAN_PAYMENTS",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[19].to_string(),
        ids.checking,
        "PDXFIT GYM PORTLAND OR MONTHLY",
        "-29.99",
        NaiveDate::from_ymd_opt(2026, 2, 15).unwrap(),
        "PERSONAL_CARE",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[20].to_string(),
        ids.checking,
        "PDXFIT GYM PORTLAND OR MONTHLY",
        "-29.99",
        NaiveDate::from_ymd_opt(2026, 3, 15).unwrap(),
        "PERSONAL_CARE",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[21].to_string(),
        ids.checking,
        "PDXFIT GYM PORTLAND OR MONTHLY",
        "-29.99",
        NaiveDate::from_ymd_opt(2026, 4, 15).unwrap(),
        "PERSONAL_CARE",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[22].to_string(),
        ids.checking,
        "PDXFIT GYM PORTLAND OR MONTHLY",
        "-29.99",
        NaiveDate::from_ymd_opt(2026, 5, 15).unwrap(),
        "PERSONAL_CARE",
        Some("other"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[23].to_string(),
        ids.checking,
        "POS DEBIT STARBUCKS #12345 SEATTLE WA",
        "-6.45",
        NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[24].to_string(),
        ids.checking,
        "POS DEBIT STARBUCKS #12345 SEATTLE WA",
        "-6.45",
        NaiveDate::from_ymd_opt(2026, 4, 10).unwrap(),
        "FOOD_AND_DRINK",
        Some("in_store"),
    );
    push_transaction(
        &mut transactions,
        seed::DEMO_SIMPLEFIN_PROVIDER_TXN_IDS[25].to_string(),
        ids.checking,
        "POS DEBIT STARBUCKS #12345 SEATTLE WA",
        "-6.45",
        NaiveDate::from_ymd_opt(2026, 5, 10).unwrap(),
        "FOOD_AND_DRINK",
        Some("in_store"),
    );

    for (index, month_start) in month_starts.iter().enumerate() {
        let month_number = index + 1;
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_rent_{month_number:02}"),
            ids.checking,
            "ROSE CITY PROPERTY MGMT",
            "-1650.00",
            *month_start,
            "RENT_AND_UTILITIES",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_power_{month_number:02}"),
            ids.credit,
            "PORTLAND GENERAL ELECTRIC",
            "-126.34",
            *month_start + Duration::days(2),
            "RENT_AND_UTILITIES",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_water_{month_number:02}"),
            ids.checking,
            "CITY OF PORTLAND WATER",
            "-72.15",
            *month_start + Duration::days(4),
            "RENT_AND_UTILITIES",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_internet_{month_number:02}"),
            ids.credit,
            "ZIPLY FIBER AUTOPAY",
            "-74.99",
            *month_start + Duration::days(5),
            "RENT_AND_UTILITIES",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_netflix_{month_number:02}"),
            ids.credit,
            "NETFLIX.COM 866-579-7172 CA",
            "-15.49",
            *month_start + Duration::days(7),
            "SUBSCRIPTION",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_spotify_{month_number:02}"),
            ids.credit,
            "SPOTIFY P0A4D3 PREMIUM",
            "-11.99",
            *month_start + Duration::days(8),
            "SUBSCRIPTION",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_target_{month_number:02}"),
            ids.credit,
            "TARGET STORE #1234 PORTLAND OR",
            "-84.16",
            *month_start + Duration::days(9),
            "SHOPPING",
            Some("in_store"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_amazon_{month_number:02}"),
            ids.credit,
            "AMAZON.COM LLC",
            "-63.47",
            *month_start + Duration::days(10),
            "GENERAL_MERCHANDISE",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_haircut_{month_number:02}"),
            ids.checking,
            "LUMIN SALON PORTLAND",
            "-48.00",
            *month_start + Duration::days(11),
            "PERSONAL_CARE",
            Some("in_store"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_charity_{month_number:02}"),
            ids.checking,
            "OREGON FOOD BANK DONATION",
            "-25.00",
            *month_start + Duration::days(12),
            "GOVERNMENT_AND_NON_PROFIT",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_loan_{month_number:02}"),
            ids.loan,
            "AUTOPAY LOAN PAYMENT",
            "-348.00",
            *month_start + Duration::days(13),
            "LOAN_PAYMENTS",
            Some("other"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_transfer_savings_out_{month_number:02}"),
            ids.checking,
            "ONLINE TRANSFER TO SAVINGS",
            "-400.00",
            *month_start + Duration::days(14),
            "TRANSFER_OUT",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_transfer_savings_in_{month_number:02}"),
            ids.savings,
            "ONLINE TRANSFER FROM CHECKING",
            "400.00",
            *month_start + Duration::days(14),
            "TRANSFER_IN",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_streaming_bundle_{month_number:02}"),
            ids.credit,
            "HULU DISNEY BUNDLE",
            "-19.99",
            *month_start + Duration::days(16),
            "SUBSCRIPTION",
            Some("online"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_other_collective_{month_number:02}"),
            ids.checking,
            "CLOUD NINE COLLECTIVE",
            "-37.25",
            *month_start + Duration::days(17),
            "OTHER",
            Some("other"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_fee_{month_number:02}"),
            ids.checking,
            "MAINTENANCE FEE REVERSAL WINDOW",
            "-12.00",
            *month_start + Duration::days(18),
            "BANK_FEES",
            Some("other"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_salary_{month_number:02}"),
            ids.checking,
            "PAYROLL DIRECT DEPOSIT SUMURAI INC",
            "5200.00",
            *month_start + Duration::days(19),
            "INCOME",
            Some("other"),
        );
        if month_number % 2 == 0 {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_movie_{month_number:02}"),
                ids.credit,
                "REGAL CINEMAS PORTLAND",
                "-28.50",
                *month_start + Duration::days(20),
                "ENTERTAINMENT",
                Some("in_store"),
            );
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_home_{month_number:02}"),
                ids.credit,
                "ACE HARDWARE STORE 221",
                "-74.80",
                *month_start + Duration::days(21),
                "HOME_IMPROVEMENT",
                Some("in_store"),
            );
        }
        if month_number % 3 == 0 {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_doctor_{month_number:02}"),
                ids.checking,
                "CASCADE FAMILY CLINIC",
                "-95.00",
                *month_start + Duration::days(22),
                "MEDICAL",
                Some("other"),
            );
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_other_market_{month_number:02}"),
                ids.checking,
                "CLOUD NINE COLLECTIVE",
                "-41.10",
                *month_start + Duration::days(23),
                "OTHER",
                Some("other"),
            );
        }
        if month_number % 4 == 0 {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_flight_{month_number:02}"),
                ids.credit,
                "ALASKA AIR 02723454",
                "-289.00",
                *month_start + Duration::days(24),
                "TRAVEL",
                Some("online"),
            );
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_hotel_{month_number:02}"),
                ids.credit,
                "HOTEL LUCIA PORTLAND",
                "-221.45",
                *month_start + Duration::days(25),
                "TRAVEL",
                Some("other"),
            );
        }
        if month_number % 2 == 1 {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_cleaning_{month_number:02}"),
                ids.checking,
                "GREENROOM CLEANING CO",
                "-135.00",
                *month_start + Duration::days(26),
                "GENERAL_SERVICES",
                Some("other"),
            );
        }
    }

    let mut week_date = NaiveDate::from_ymd_opt(2025, 6, 16).unwrap();
    let mut week_index = 1usize;
    while week_date <= authored_latest {
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_groceries_{week_index:03}"),
            ids.credit,
            "WHOLEFDS MKT #10452 PORTLAND OR",
            "-138.22",
            week_date,
            "FOOD_AND_DRINK",
            Some("in_store"),
        );
        push_transaction(
            &mut transactions,
            format!("sumurai_demo_coffee_{week_index:03}"),
            ids.checking,
            "BLUE BOTTLE COFFEE",
            "-8.40",
            week_date + Duration::days(2),
            "FOOD_AND_DRINK",
            Some("in_store"),
        );
        if week_index.is_multiple_of(2) {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_gas_{week_index:03}"),
                ids.credit,
                "SHELL OIL 59401234 DEBIT PURCHASE",
                "-48.75",
                week_date + Duration::days(3),
                "TRANSPORTATION",
                Some("in_store"),
            );
        }
        if week_index.is_multiple_of(3) {
            push_transaction(
                &mut transactions,
                format!("sumurai_demo_rideshare_{week_index:03}"),
                ids.credit,
                "UBER* TRIPS HELP.UBER.COM CA",
                "-19.85",
                week_date + Duration::days(4),
                "TRANSPORTATION",
                Some("online"),
            );
        }
        week_date += Duration::days(7);
        week_index += 1;
    }

    transactions
}

fn authored_month_starts() -> Vec<NaiveDate> {
    let mut months = Vec::new();
    let start = NaiveDate::from_ymd_opt(2025, 7, 1).unwrap();
    for index in 0..12u32 {
        months.push(start.checked_add_months(Months::new(index)).unwrap());
    }
    months
}

#[allow(clippy::too_many_arguments)]
fn push_transaction(
    transactions: &mut Vec<AuthoredTransaction>,
    provider_transaction_id: String,
    account_id: Uuid,
    raw_merchant: &str,
    amount: &str,
    date: NaiveDate,
    category_primary: &str,
    payment_channel: Option<&str>,
) {
    transactions.push(AuthoredTransaction {
        provider_transaction_id,
        account_id,
        amount: decimal(amount),
        date,
        raw_merchant: raw_merchant.to_string(),
        category_primary: category_primary.to_string(),
        payment_channel: payment_channel.map(str::to_string),
    });
}

fn apply_runtime_offset(transactions: &mut [AuthoredTransaction], offset_days: i64) {
    if offset_days == 0 {
        return;
    }

    let shift = Duration::days(offset_days);
    for transaction in transactions {
        transaction.date += shift;
    }
}

async fn to_transactions(
    user_id: Uuid,
    now: chrono::DateTime<Utc>,
    authored_transactions: &[AuthoredTransaction],
    normalization_service: &MerchantNormalizationService,
) -> Result<Vec<Transaction>> {
    let mut transactions: Vec<Transaction> = authored_transactions
        .iter()
        .map(|authored| Transaction {
            id: seed::demo_entity_id(
                user_id,
                &format!("txn:{}", authored.provider_transaction_id),
            ),
            account_id: authored.account_id,
            user_id: Some(user_id),
            provider_account_id: None,
            provider_transaction_id: Some(authored.provider_transaction_id.clone()),
            amount: authored.amount,
            date: authored.date,
            merchant_name: Some(authored.raw_merchant.clone()),
            category_primary: authored.category_primary.clone(),
            category_detailed: category_detail(&authored.category_primary).to_string(),
            category_confidence: "high".to_string(),
            payment_channel: authored.payment_channel.clone(),
            pending: false,
            created_at: Some(now),
            original_merchant_name: Some(authored.raw_merchant.clone()),
            normalized_merchant: None,
            normalization_source: None,
        })
        .collect();

    normalization_service
        .normalize_batch(&mut transactions)
        .await?;
    Ok(transactions)
}

fn ensure_category_coverage(transactions: &[Transaction]) -> Result<()> {
    let present = transactions
        .iter()
        .map(|transaction| transaction.category_primary.as_str())
        .collect::<BTreeSet<_>>();
    let missing = SYSTEM_CATEGORY_SLUGS
        .iter()
        .copied()
        .filter(|slug| !present.contains(slug))
        .collect::<Vec<_>>();

    if missing.is_empty() {
        return Ok(());
    }

    Err(anyhow::anyhow!(
        "Demo dataset missing category coverage for {}",
        missing.join(", ")
    ))
}

fn ensure_transaction_contract(transactions: &[Transaction]) -> Result<()> {
    let max_date = transactions
        .iter()
        .map(|transaction| transaction.date)
        .max();
    let current_date = Utc::now().date_naive();
    let expected_latest = if current_date >= authored_latest_transaction_date() {
        current_date
    } else {
        authored_latest_transaction_date()
    };
    if transactions.len() < seed::MIN_DEMO_TRANSACTION_COUNT {
        return Err(anyhow::anyhow!(
            "Demo dataset only generated {} transactions",
            transactions.len()
        ));
    }
    if max_date != Some(expected_latest) {
        return Err(anyhow::anyhow!(
            "Demo dataset did not preserve the expected latest date"
        ));
    }
    if transactions.iter().any(|transaction| {
        transaction.original_merchant_name.is_none()
            || transaction
                .normalized_merchant
                .as_deref()
                .is_none_or(str::is_empty)
    }) {
        return Err(anyhow::anyhow!(
            "Demo dataset did not populate merchant normalization fields"
        ));
    }
    Ok(())
}

async fn seed_budgets(
    db: &Arc<dyn DatabaseRepository>,
    user_id: Uuid,
    transactions: &[Transaction],
) -> Result<()> {
    let existing = db
        .get_budgets_for_user(user_id)
        .await?
        .into_iter()
        .map(|budget| budget.category.to_uppercase())
        .collect::<BTreeSet<_>>();

    let categories = transactions
        .iter()
        .map(|transaction| transaction.category_primary.as_str())
        .filter(|category| is_budget_seed_category(category))
        .collect::<BTreeSet<_>>();

    let budget_service = BudgetService::new();
    for category in categories {
        if existing.contains(category) {
            continue;
        }
        budget_service
            .create_budget_for_user(
                &**db,
                user_id,
                category.to_string(),
                budget_amount_for_category(category),
            )
            .await
            .map_err(anyhow::Error::msg)?;
    }

    Ok(())
}

fn is_budget_seed_category(category: &str) -> bool {
    matches!(
        category,
        "ENTERTAINMENT"
            | "FOOD_AND_DRINK"
            | "GENERAL_MERCHANDISE"
            | "GENERAL_SERVICES"
            | "HOME_IMPROVEMENT"
            | "MEDICAL"
            | "PERSONAL_CARE"
            | "RENT_AND_UTILITIES"
            | "SHOPPING"
            | "SUBSCRIPTION"
            | "TRANSPORTATION"
            | "TRAVEL"
    )
}

fn budget_amount_for_category(category: &str) -> Decimal {
    match category {
        "RENT_AND_UTILITIES" => decimal("2300.00"),
        "FOOD_AND_DRINK" => decimal("950.00"),
        "TRANSPORTATION" => decimal("350.00"),
        "SUBSCRIPTION" => decimal("90.00"),
        "SHOPPING" => decimal("250.00"),
        "GENERAL_MERCHANDISE" => decimal("300.00"),
        "GENERAL_SERVICES" => decimal("220.00"),
        "MEDICAL" => decimal("180.00"),
        "HOME_IMPROVEMENT" => decimal("200.00"),
        "PERSONAL_CARE" => decimal("120.00"),
        "ENTERTAINMENT" => decimal("140.00"),
        "TRAVEL" => decimal("400.00"),
        _ => decimal(MIN_BUDGET_AMOUNT),
    }
}

fn category_detail(category_primary: &str) -> &'static str {
    match category_primary {
        "BANK_FEES" => "Bank fees",
        "ENTERTAINMENT" => "Entertainment",
        "FOOD_AND_DRINK" => "Food & Drink",
        "GENERAL_MERCHANDISE" => "General merchandise",
        "GENERAL_SERVICES" => "General services",
        "GOVERNMENT_AND_NON_PROFIT" => "Government & non profit",
        "HOME_IMPROVEMENT" => "Home improvement",
        "INCOME" => "Income",
        "LOAN_PAYMENTS" => "Loan payments",
        "MEDICAL" => "Medical",
        "OTHER" => "Other",
        "PERSONAL_CARE" => "Personal care",
        "RENT_AND_UTILITIES" => "Rent & utilities",
        "SHOPPING" => "Shopping",
        "SUBSCRIPTION" => "Subscription",
        "TRANSFER_IN" => "Transfer in",
        "TRANSFER_OUT" => "Transfer out",
        "TRANSPORTATION" => "Transportation",
        "TRAVEL" => "Travel",
        _ => "Other",
    }
}

fn decimal(value: &str) -> Decimal {
    Decimal::from_str(value).unwrap()
}
