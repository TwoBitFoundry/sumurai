use crate::models::transaction::Transaction;
use std::collections::HashSet;
use uuid::Uuid;

pub fn filter_transactions_by_account_ids(
    transactions: Vec<Transaction>,
    account_id_strings: &[String],
) -> Vec<Transaction> {
    if account_id_strings.is_empty() {
        return transactions;
    }

    let account_ids: HashSet<Uuid> = account_id_strings
        .iter()
        .filter_map(|s| Uuid::parse_str(s).ok())
        .collect();

    transactions
        .into_iter()
        .filter(|t| account_ids.contains(&t.account_id))
        .collect()
}
