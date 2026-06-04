use chrono::NaiveDate;
use rust_decimal_macros::dec;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::transaction::TransactionWithAccount;
use crate::services::export_service::ExportService;

struct AccountFixture<'a> {
    id: Uuid,
    name: &'a str,
    account_type: &'a str,
    balance: Option<rust_decimal::Decimal>,
    mask: Option<&'a str>,
    institution_name: Option<&'a str>,
}

fn sample_account(fixture: AccountFixture<'_>) -> Account {
    Account {
        id: fixture.id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{}", fixture.id)),
        provider_connection_id: Some(Uuid::new_v4()),
        name: fixture.name.to_string(),
        account_type: fixture.account_type.to_string(),
        balance_current: fixture.balance,
        mask: fixture.mask.map(str::to_string),
        institution_name: fixture.institution_name.map(str::to_string),
        provider_conn_id: None,
    }
}

struct TransactionFixture<'a> {
    account_id: Uuid,
    account_name: &'a str,
    account_type: &'a str,
    account_mask: Option<&'a str>,
    amount: rust_decimal::Decimal,
    date: NaiveDate,
    merchant_name: Option<&'a str>,
    category_primary: &'a str,
    provider_transaction_id: Option<&'a str>,
}

fn sample_transaction(fixture: TransactionFixture<'_>) -> TransactionWithAccount {
    TransactionWithAccount {
        id: Uuid::new_v4(),
        account_id: fixture.account_id,
        user_id: Some(Uuid::new_v4()),
        provider_account_id: Some(format!("provider-{}", fixture.account_id)),
        provider_transaction_id: fixture.provider_transaction_id.map(str::to_string),
        amount: fixture.amount,
        date: fixture.date,
        merchant_name: fixture.merchant_name.map(str::to_string),
        category_primary: fixture.category_primary.to_string(),
        category_detailed: fixture.category_primary.to_string(),
        category_confidence: "high".to_string(),
        payment_channel: Some("online".to_string()),
        pending: false,
        created_at: None,
        account_name: fixture.account_name.to_string(),
        account_type: fixture.account_type.to_string(),
        account_mask: fixture.account_mask.map(str::to_string),
        is_custom: false,
        is_overridden: false,
    }
}

#[test]
fn given_accounts_and_transactions_when_exporting_csv_then_writes_header_rows_and_summary_rows() {
    let checking_id = Uuid::new_v4();
    let savings_id = Uuid::new_v4();
    let accounts = vec![
        sample_account(AccountFixture {
            id: checking_id,
            name: "Demo Checking",
            account_type: "depository",
            balance: Some(dec!(1234.56)),
            mask: Some("1234"),
            institution_name: Some("Demo Bank"),
        }),
        sample_account(AccountFixture {
            id: savings_id,
            name: "Demo Savings",
            account_type: "depository",
            balance: Some(dec!(500.00)),
            mask: Some("5678"),
            institution_name: Some("Demo Bank"),
        }),
    ];
    let transactions = vec![sample_transaction(TransactionFixture {
        account_id: checking_id,
        account_name: "Demo Checking",
        account_type: "depository",
        account_mask: Some("1234"),
        amount: dec!(-12.34),
        date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        merchant_name: Some("Coffee & Tea <Cafe>"),
        category_primary: "FOOD",
        provider_transaction_id: Some("txn-1"),
    })];

    let csv = ExportService::to_csv(&accounts, &transactions);

    assert_eq!(
        csv,
        "Date,Institution,Account,Account Type,Mask,Balance,Description,Amount,Category,Pending,Transaction ID\n\
2024-01-15,Demo Bank,Demo Checking,depository,1234,1234.56,Coffee & Tea <Cafe>,-12.34,FOOD,false,txn-1\n\
,Demo Bank,Demo Savings,depository,5678,500,,,,,\n"
    );
}

#[test]
fn given_transactions_across_accounts_when_exporting_csv_then_orders_rows_by_date() {
    let checking_id = Uuid::new_v4();
    let savings_id = Uuid::new_v4();
    let accounts = vec![
        sample_account(AccountFixture {
            id: checking_id,
            name: "Demo Checking",
            account_type: "depository",
            balance: Some(dec!(1234.56)),
            mask: Some("1234"),
            institution_name: Some("Demo Bank"),
        }),
        sample_account(AccountFixture {
            id: savings_id,
            name: "Demo Savings",
            account_type: "depository",
            balance: Some(dec!(500.00)),
            mask: Some("5678"),
            institution_name: Some("Demo Bank"),
        }),
    ];
    let transactions = vec![
        sample_transaction(TransactionFixture {
            account_id: checking_id,
            account_name: "Demo Checking",
            account_type: "depository",
            account_mask: Some("1234"),
            amount: dec!(-12.34),
            date: NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
            merchant_name: Some("Older Purchase"),
            category_primary: "FOOD",
            provider_transaction_id: Some("txn-older"),
        }),
        sample_transaction(TransactionFixture {
            account_id: savings_id,
            account_name: "Demo Savings",
            account_type: "depository",
            account_mask: Some("5678"),
            amount: dec!(25.00),
            date: NaiveDate::from_ymd_opt(2024, 1, 12).unwrap(),
            merchant_name: Some("Newer Deposit"),
            category_primary: "INCOME",
            provider_transaction_id: Some("txn-newer"),
        }),
        sample_transaction(TransactionFixture {
            account_id: checking_id,
            account_name: "Demo Checking",
            account_type: "depository",
            account_mask: Some("1234"),
            amount: dec!(-8.50),
            date: NaiveDate::from_ymd_opt(2024, 1, 11).unwrap(),
            merchant_name: Some("Middle Purchase"),
            category_primary: "FOOD",
            provider_transaction_id: Some("txn-middle"),
        }),
    ];

    let csv = ExportService::to_csv(&accounts, &transactions);

    assert_eq!(
        csv,
        "Date,Institution,Account,Account Type,Mask,Balance,Description,Amount,Category,Pending,Transaction ID\n\
2024-01-12,Demo Bank,Demo Savings,depository,5678,500,Newer Deposit,25,INCOME,false,txn-newer\n\
2024-01-11,Demo Bank,Demo Checking,depository,1234,1234.56,Middle Purchase,-8.5,FOOD,false,txn-middle\n\
2024-01-10,Demo Bank,Demo Checking,depository,1234,1234.56,Older Purchase,-12.34,FOOD,false,txn-older\n"
    );
}

#[test]
fn given_depository_and_credit_accounts_when_exporting_ofx_then_routes_and_escapes_text() {
    let checking_id = Uuid::new_v4();
    let credit_id = Uuid::new_v4();
    let accounts = vec![
        sample_account(AccountFixture {
            id: checking_id,
            name: "Demo Checking",
            account_type: "depository",
            balance: Some(dec!(1234.56)),
            mask: Some("1234"),
            institution_name: Some("Demo Bank"),
        }),
        sample_account(AccountFixture {
            id: credit_id,
            name: "Demo Card",
            account_type: "credit",
            balance: Some(dec!(-250.00)),
            mask: Some("9876"),
            institution_name: Some("Demo Card Bank"),
        }),
    ];
    let transactions = vec![
        sample_transaction(TransactionFixture {
            account_id: checking_id,
            account_name: "Demo Checking",
            account_type: "depository",
            account_mask: Some("1234"),
            amount: dec!(-12.34),
            date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            merchant_name: Some("Coffee & Tea <Cafe>"),
            category_primary: "FOOD",
            provider_transaction_id: Some("txn-1"),
        }),
        sample_transaction(TransactionFixture {
            account_id: credit_id,
            account_name: "Demo Card",
            account_type: "credit",
            account_mask: Some("9876"),
            amount: dec!(18.50),
            date: NaiveDate::from_ymd_opt(2024, 1, 16).unwrap(),
            merchant_name: Some("Refund"),
            category_primary: "REFUND",
            provider_transaction_id: Some("txn-2"),
        }),
    ];

    let ofx = ExportService::to_ofx(&accounts, &transactions);

    assert!(ofx.starts_with(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<?OFX OFXHEADER=\"200\" VERSION=\"220\" SECURITY=\"NONE\" OLDFILEUID=\"NONE\" NEWFILEUID=\"NONE\"?>\n<OFX>"
    ));
    assert!(ofx.contains("<BANKMSGSRSV1>"));
    assert!(ofx.contains("<CREDITCARDMSGSRSV1>"));
    assert!(ofx.contains("<TRNTYPE>DEBIT</TRNTYPE>"));
    assert!(ofx.contains("<TRNTYPE>CREDIT</TRNTYPE>"));
    assert!(ofx.contains("Coffee &amp; Tea &lt;Cafe&gt;"));
    assert!(ofx.contains("<ACCTTYPE>CHECKING</ACCTTYPE>"));
    assert!(ofx.contains("<ACCTID>1234</ACCTID>"));
    assert!(ofx.contains("<ACCTID>9876</ACCTID>"));

    let mut reader = quick_xml::Reader::from_str(&ofx);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(quick_xml::events::Event::Eof) => break,
            Ok(_) => {}
            Err(err) => panic!("OFX output is not well-formed: {err}"),
        }
        buffer.clear();
    }
}

#[test]
fn given_transactions_out_of_order_when_exporting_ofx_then_orders_each_statement_by_date() {
    let account_id = Uuid::new_v4();
    let accounts = vec![sample_account(AccountFixture {
        id: account_id,
        name: "Demo Checking",
        account_type: "depository",
        balance: Some(dec!(1234.56)),
        mask: Some("1234"),
        institution_name: Some("Demo Bank"),
    })];
    let transactions = vec![
        sample_transaction(TransactionFixture {
            account_id,
            account_name: "Demo Checking",
            account_type: "depository",
            account_mask: Some("1234"),
            amount: dec!(-8.50),
            date: NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
            merchant_name: Some("Older Purchase"),
            category_primary: "FOOD",
            provider_transaction_id: Some("txn-older"),
        }),
        sample_transaction(TransactionFixture {
            account_id,
            account_name: "Demo Checking",
            account_type: "depository",
            account_mask: Some("1234"),
            amount: dec!(-12.34),
            date: NaiveDate::from_ymd_opt(2024, 1, 12).unwrap(),
            merchant_name: Some("Newer Purchase"),
            category_primary: "FOOD",
            provider_transaction_id: Some("txn-newer"),
        }),
    ];

    let ofx = ExportService::to_ofx(&accounts, &transactions);

    let newer_index = ofx.find("txn-newer").expect("newer transaction missing");
    let older_index = ofx.find("txn-older").expect("older transaction missing");

    assert!(newer_index < older_index);
}
