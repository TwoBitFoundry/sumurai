#![allow(dead_code)]

use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::io::Cursor;

use chrono::{NaiveDate, Utc};
use csv::WriterBuilder;
use quick_xml::events::{BytesEnd, BytesStart, BytesText, Event};
use quick_xml::writer::Writer;
use rust_decimal::Decimal;

use crate::models::account::Account;
use crate::models::transaction::TransactionWithAccount;

pub struct ExportService;

#[derive(Clone)]
struct ExportRow {
    date: String,
    institution: String,
    account: String,
    account_type: String,
    mask: String,
    balance: String,
    description: String,
    amount: String,
    category: String,
    pending: String,
    transaction_id: String,
}

impl ExportService {
    pub fn to_csv(accounts: &[Account], transactions: &[TransactionWithAccount]) -> String {
        let mut writer = WriterBuilder::new()
            .has_headers(false)
            .terminator(csv::Terminator::Any(b'\n'))
            .from_writer(Vec::new());

        writer
            .write_record([
                "Date",
                "Institution",
                "Account",
                "Account Type",
                "Mask",
                "Balance",
                "Description",
                "Amount",
                "Category",
                "Pending",
                "Transaction ID",
            ])
            .expect("failed to write export header");

        let account_by_id: HashMap<_, _> = accounts
            .iter()
            .map(|account| (account.id, account))
            .collect();
        let mut rows: Vec<(Option<NaiveDate>, ExportRow)> = transactions
            .iter()
            .map(|transaction| {
                let account = account_by_id.get(&transaction.account_id);
                (
                    Some(transaction.date),
                    ExportRow {
                        date: transaction.date.to_string(),
                        institution: account
                            .and_then(|account| account.institution_name.clone())
                            .unwrap_or_default(),
                        account: transaction.account_name.clone(),
                        account_type: transaction.account_type.clone(),
                        mask: transaction.account_mask.clone().unwrap_or_default(),
                        balance: account
                            .map(|account| format_balance(account.balance_current))
                            .unwrap_or_default(),
                        description: transaction.merchant_name.clone().unwrap_or_default(),
                        amount: format_amount(transaction.amount),
                        category: transaction.category_primary.clone(),
                        pending: transaction.pending.to_string(),
                        transaction_id: transaction
                            .provider_transaction_id
                            .clone()
                            .unwrap_or_default(),
                    },
                )
            })
            .collect();

        let transaction_accounts: HashSet<_> = transactions
            .iter()
            .map(|transaction| transaction.account_id)
            .collect();

        rows.extend(
            accounts
                .iter()
                .filter(|account| !transaction_accounts.contains(&account.id))
                .map(|account| {
                    (
                        None,
                        ExportRow {
                            date: String::new(),
                            institution: account.institution_name.clone().unwrap_or_default(),
                            account: account.name.clone(),
                            account_type: account.account_type.clone(),
                            mask: account.mask.clone().unwrap_or_default(),
                            balance: format_balance(account.balance_current),
                            description: String::new(),
                            amount: String::new(),
                            category: String::new(),
                            pending: String::new(),
                            transaction_id: String::new(),
                        },
                    )
                }),
        );

        rows.sort_by(|(left_date, left_row), (right_date, right_row)| {
            match (left_date, right_date) {
                (Some(left), Some(right)) => right
                    .cmp(left)
                    .then_with(|| compare_csv_rows(left_row, right_row)),
                (Some(_), None) => Ordering::Less,
                (None, Some(_)) => Ordering::Greater,
                (None, None) => compare_csv_rows(left_row, right_row),
            }
        });

        for (_, row) in rows {
            write_csv_row(&mut writer, row);
        }

        String::from_utf8(writer.into_inner().expect("failed to finish CSV export"))
            .expect("CSV export is valid UTF-8")
    }

    pub fn to_ofx(accounts: &[Account], transactions: &[TransactionWithAccount]) -> String {
        let mut output =
            String::from("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n");
        output.push_str(
            "<?OFX OFXHEADER=\"200\" VERSION=\"220\" SECURITY=\"NONE\" OLDFILEUID=\"NONE\" NEWFILEUID=\"NONE\"?>\n",
        );

        let mut writer = Writer::new(Cursor::new(Vec::new()));
        write_event(&mut writer, Event::Start(BytesStart::new("OFX")));

        write_event(&mut writer, Event::Start(BytesStart::new("SIGNONMSGSRSV1")));
        write_event(&mut writer, Event::Start(BytesStart::new("SONRS")));
        write_event(&mut writer, Event::Start(BytesStart::new("STATUS")));
        write_text_element(&mut writer, "CODE", "0");
        write_text_element(&mut writer, "SEVERITY", "INFO");
        write_event(&mut writer, Event::End(BytesEnd::new("STATUS")));
        let dtserver = Utc::now().format("%Y%m%d%H%M%S").to_string();
        write_text_element(&mut writer, "DTSERVER", &dtserver);
        write_text_element(&mut writer, "LANGUAGE", "ENG");
        write_event(&mut writer, Event::End(BytesEnd::new("SONRS")));
        write_event(&mut writer, Event::End(BytesEnd::new("SIGNONMSGSRSV1")));

        let grouped_transactions = group_transactions(transactions);

        let mut ordered_accounts: Vec<_> = accounts.iter().collect();
        ordered_accounts
            .sort_by(|left, right| compare_account_activity(left, right, &grouped_transactions));

        for account in ordered_accounts {
            let mut account_transactions = grouped_transactions
                .get(&account.id)
                .cloned()
                .unwrap_or_default();
            account_transactions.sort_by_key(|transaction| std::cmp::Reverse(transaction.date));
            let statement_kind = statement_kind(account);
            let statement_root = match statement_kind {
                StatementKind::Bank => "BANKMSGSRSV1",
                StatementKind::Credit => "CREDITCARDMSGSRSV1",
            };
            let statement_response = match statement_kind {
                StatementKind::Bank => "STMTTRNRS",
                StatementKind::Credit => "CCSTMTTRNRS",
            };
            let statement_body = match statement_kind {
                StatementKind::Bank => "STMTRS",
                StatementKind::Credit => "CCSTMTRS",
            };
            let account_from = match statement_kind {
                StatementKind::Bank => "BANKACCTFROM",
                StatementKind::Credit => "CCACCTFROM",
            };
            let ledger_balance = ledger_balance_for_account(account, &account_transactions);
            let date_start = account_transactions
                .iter()
                .map(|transaction| transaction.date)
                .min()
                .unwrap_or_else(|| Utc::now().date_naive());
            let date_end = account_transactions
                .iter()
                .map(|transaction| transaction.date)
                .max()
                .unwrap_or(date_start);

            write_event(&mut writer, Event::Start(BytesStart::new(statement_root)));
            write_event(
                &mut writer,
                Event::Start(BytesStart::new(statement_response)),
            );
            let trnuid = account.id.to_string();
            write_text_element(&mut writer, "TRNUID", &trnuid);
            write_event(&mut writer, Event::Start(BytesStart::new(statement_body)));
            write_text_element(&mut writer, "CURDEF", "USD");
            write_event(&mut writer, Event::Start(BytesStart::new(account_from)));
            write_text_element(&mut writer, "BANKID", "SUMURAI");
            let acctid = account_id_for_ofx(account);
            write_text_element(&mut writer, "ACCTID", &acctid);
            if matches!(statement_kind, StatementKind::Bank) {
                write_text_element(&mut writer, "ACCTTYPE", account_type_for_bank(account));
            }
            write_event(&mut writer, Event::End(BytesEnd::new(account_from)));

            write_event(&mut writer, Event::Start(BytesStart::new("BANKTRANLIST")));
            let dtstart = format_ofx_date(date_start);
            let dtend = format_ofx_date(date_end);
            write_text_element(&mut writer, "DTSTART", &dtstart);
            write_text_element(&mut writer, "DTEND", &dtend);
            for transaction in account_transactions {
                write_event(&mut writer, Event::Start(BytesStart::new("STMTTRN")));
                let trntype = trn_type(transaction.amount);
                let dtposted = format_ofx_date(transaction.date);
                let trnamt = format_amount(transaction.amount);
                let fitid = transaction
                    .provider_transaction_id
                    .clone()
                    .unwrap_or_else(|| transaction.id.to_string());
                let name = transaction
                    .merchant_name
                    .clone()
                    .unwrap_or_else(|| transaction.account_name.clone());
                write_text_element(&mut writer, "TRNTYPE", trntype);
                write_text_element(&mut writer, "DTPOSTED", &dtposted);
                write_text_element(&mut writer, "TRNAMT", &trnamt);
                write_text_element(&mut writer, "FITID", &fitid);
                write_text_element(&mut writer, "NAME", &name);
                let memo = transaction.category_detailed.clone();
                write_text_element(&mut writer, "MEMO", &memo);
                write_event(&mut writer, Event::End(BytesEnd::new("STMTTRN")));
            }
            write_event(&mut writer, Event::End(BytesEnd::new("BANKTRANLIST")));
            write_event(&mut writer, Event::Start(BytesStart::new("LEDGERBAL")));
            write_text_element(&mut writer, "BALAMT", &ledger_balance);
            let dtasof = format_ofx_date(date_end);
            write_text_element(&mut writer, "DTASOF", &dtasof);
            write_event(&mut writer, Event::End(BytesEnd::new("LEDGERBAL")));
            write_event(&mut writer, Event::End(BytesEnd::new(statement_body)));
            write_event(&mut writer, Event::End(BytesEnd::new(statement_response)));
            write_event(&mut writer, Event::End(BytesEnd::new(statement_root)));
        }

        write_event(&mut writer, Event::End(BytesEnd::new("OFX")));

        let body =
            String::from_utf8(writer.into_inner().into_inner()).expect("OFX export is valid UTF-8");
        output.push_str(&body);
        output
    }
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum StatementKind {
    Bank,
    Credit,
}

fn write_csv_row(writer: &mut csv::Writer<Vec<u8>>, row: ExportRow) {
    writer
        .write_record([
            row.date,
            row.institution,
            row.account,
            row.account_type,
            row.mask,
            row.balance,
            row.description,
            row.amount,
            row.category,
            row.pending,
            row.transaction_id,
        ])
        .expect("failed to write CSV export row");
}

fn format_amount(amount: Decimal) -> String {
    amount.normalize().to_string()
}

fn format_balance(balance: Option<Decimal>) -> String {
    balance.map(format_amount).unwrap_or_default()
}

fn compare_csv_rows(left: &ExportRow, right: &ExportRow) -> Ordering {
    left.institution
        .cmp(&right.institution)
        .then_with(|| left.account.cmp(&right.account))
        .then_with(|| left.description.cmp(&right.description))
        .then_with(|| left.transaction_id.cmp(&right.transaction_id))
}

fn group_transactions(
    transactions: &[TransactionWithAccount],
) -> HashMap<uuid::Uuid, Vec<&TransactionWithAccount>> {
    let mut groups: HashMap<uuid::Uuid, Vec<&TransactionWithAccount>> = HashMap::new();
    for transaction in transactions {
        groups
            .entry(transaction.account_id)
            .or_default()
            .push(transaction);
    }
    groups
}

fn compare_account_activity(
    left: &Account,
    right: &Account,
    grouped_transactions: &HashMap<uuid::Uuid, Vec<&TransactionWithAccount>>,
) -> Ordering {
    let left_date = grouped_transactions.get(&left.id).and_then(|transactions| {
        transactions
            .iter()
            .map(|transaction| transaction.date)
            .max()
    });
    let right_date = grouped_transactions
        .get(&right.id)
        .and_then(|transactions| {
            transactions
                .iter()
                .map(|transaction| transaction.date)
                .max()
        });

    match (left_date, right_date) {
        (Some(left_date), Some(right_date)) => right_date
            .cmp(&left_date)
            .then_with(|| left.name.cmp(&right.name)),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => left.name.cmp(&right.name),
    }
}

fn statement_kind(account: &Account) -> StatementKind {
    let normalized = account.account_type.to_ascii_lowercase();
    if normalized.contains("credit") {
        StatementKind::Credit
    } else {
        StatementKind::Bank
    }
}

fn account_type_for_bank(account: &Account) -> &str {
    let normalized = account.account_type.to_ascii_lowercase();
    if normalized.contains("savings") {
        "SAVINGS"
    } else {
        "CHECKING"
    }
}

fn account_id_for_ofx(account: &Account) -> String {
    account
        .mask
        .clone()
        .or_else(|| account.provider_account_id.clone())
        .unwrap_or_else(|| account.id.to_string())
}

fn ledger_balance_for_account(
    account: &Account,
    transactions: &[&TransactionWithAccount],
) -> String {
    if let Some(balance) = account.balance_current {
        return format_amount(balance);
    }

    let last_amount = transactions.last().map(|transaction| transaction.amount);
    last_amount
        .map(format_amount)
        .unwrap_or_else(|| "0".to_string())
}

fn format_ofx_date(date: NaiveDate) -> String {
    date.format("%Y%m%d").to_string()
}

fn trn_type(amount: Decimal) -> &'static str {
    if amount < Decimal::ZERO {
        "DEBIT"
    } else {
        "CREDIT"
    }
}

fn write_event(writer: &mut Writer<Cursor<Vec<u8>>>, event: Event<'_>) {
    writer
        .write_event(event)
        .expect("failed to write OFX event");
}

fn write_text_element(writer: &mut Writer<Cursor<Vec<u8>>>, name: &str, value: &str) {
    write_event(writer, Event::Start(BytesStart::new(name)));
    write_event(writer, Event::Text(BytesText::new(value)));
    write_event(writer, Event::End(BytesEnd::new(name)));
}
