use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use base64::Engine;
use chrono::{Duration, NaiveDate, TimeZone, Utc};
use reqwest::Client;
use reqwest::Url;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::simplefin::{SimpleFinAccount, SimpleFinAccountsResponse, SimpleFinTransaction};
use crate::models::transaction::{ProviderTransactionsResult, Transaction};
use crate::providers::trait_definition::{
    FinancialDataProvider, InstitutionInfo, ProviderCredentials,
};

const MAX_TRANSACTION_WINDOW_DAYS: i64 = 90;
pub(crate) const BETA_DEMO_BRIDGE_ACCESS_URL: &str =
    "https://demo:demo@beta-bridge.simplefin.org/simplefin";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SimpleFinProviderError {
    SetupTokenAlreadyClaimed,
    NotApplicableForSimpleFin,
    RateLimited(String),
}

impl std::fmt::Display for SimpleFinProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SetupTokenAlreadyClaimed => {
                f.write_str("SimpleFIN setup token has already been claimed")
            }
            Self::NotApplicableForSimpleFin => {
                f.write_str("operation is not applicable for SimpleFIN")
            }
            Self::RateLimited(msg) => {
                write!(f, "SimpleFIN rate limited: {}", msg)
            }
        }
    }
}

impl std::error::Error for SimpleFinProviderError {}

#[derive(Debug, Clone, Default)]
pub struct AccountsQuery {
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
    pub pending: bool,
    pub balances_only: bool,
    pub account_ids: Vec<String>,
}

#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait SimpleFinHttpClient: Send + Sync {
    async fn claim(&self, claim_url: &str) -> Result<String>;
    async fn get_accounts(
        &self,
        access_url: &str,
        params: AccountsQuery,
    ) -> Result<SimpleFinAccountsResponse>;
}

struct RealSimpleFinHttpClient {
    client: Client,
}

impl RealSimpleFinHttpClient {
    fn new() -> Result<Self> {
        let client = Client::builder().build()?;
        Ok(Self { client })
    }
}

fn parse_access_url(access_url: &str) -> Result<(Url, String, String)> {
    let mut url = Url::parse(access_url.trim()).context("invalid SimpleFIN access URL")?;
    if url.scheme() != "https" {
        bail!("SimpleFIN access URL must use HTTPS");
    }
    let username = url.username().to_string();
    let password = url.password().unwrap_or_default().to_string();
    if !username.is_empty() {
        url.set_username("")
            .map_err(|_| anyhow::anyhow!("invalid SimpleFIN access URL username"))?;
    }
    if url.password().is_some() {
        url.set_password(None)
            .map_err(|_| anyhow::anyhow!("invalid SimpleFIN access URL password"))?;
    }
    Ok((url, username, password))
}

fn build_accounts_url(base: &Url, params: &AccountsQuery) -> Result<Url> {
    let path = base.path().trim_end_matches('/');
    let accounts_path = if path.is_empty() {
        "/accounts".to_string()
    } else {
        format!("{path}/accounts")
    };
    let mut url = base.clone();
    url.set_path(&accounts_path);
    url.set_query(None);

    {
        let mut query_pairs = url.query_pairs_mut();
        if let Some(start_date) = params.start_date {
            query_pairs.append_pair("start-date", &start_date.to_string());
        }
        if let Some(end_date) = params.end_date {
            query_pairs.append_pair("end-date", &end_date.to_string());
        }
        if params.pending {
            query_pairs.append_pair("pending", "1");
        }
        if params.balances_only {
            query_pairs.append_pair("balances-only", "1");
        }
        for account_id in &params.account_ids {
            query_pairs.append_pair("account", account_id);
        }
    }

    Ok(url)
}

#[async_trait]
impl SimpleFinHttpClient for RealSimpleFinHttpClient {
    async fn claim(&self, claim_url: &str) -> Result<String> {
        let response = self.client.post(claim_url).send().await?;
        if response.status() == reqwest::StatusCode::FORBIDDEN {
            return Err(anyhow::Error::new(
                SimpleFinProviderError::SetupTokenAlreadyClaimed,
            ));
        }
        if !response.status().is_success() {
            bail!(
                "SimpleFIN claim failed with status {}",
                response.status().as_u16()
            );
        }
        Ok(response.text().await?.trim().to_string())
    }

    async fn get_accounts(
        &self,
        access_url: &str,
        params: AccountsQuery,
    ) -> Result<SimpleFinAccountsResponse> {
        let (base, username, password) = parse_access_url(access_url)?;
        let url = build_accounts_url(&base, &params)?;
        let response = self
            .client
            .get(url)
            .basic_auth(username, Some(password))
            .send()
            .await?;
        let status = response.status();
        let body = response.text().await?;
        if !status.is_success() {
            if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                if let Ok(mut parsed) = serde_json::from_str::<SimpleFinAccountsResponse>(&body) {
                    parsed.normalize();
                    let messages = parsed.error_messages();
                    if !messages.is_empty() {
                        return Err(anyhow::Error::new(SimpleFinProviderError::RateLimited(
                            messages.join("; "),
                        )));
                    }
                }
                return Err(anyhow::Error::new(SimpleFinProviderError::RateLimited(
                    body.chars().take(240).collect::<String>(),
                )));
            }
            if let Ok(mut parsed) = serde_json::from_str::<SimpleFinAccountsResponse>(&body) {
                parsed.normalize();
                let messages = parsed.error_messages();
                if !messages.is_empty() {
                    bail!(
                        "SimpleFIN accounts request failed with status {}: {}",
                        status.as_u16(),
                        messages.join("; ")
                    );
                }
            }
            bail!(
                "SimpleFIN accounts request failed with status {}: {}",
                status.as_u16(),
                body.chars().take(240).collect::<String>()
            );
        }

        let mut parsed: SimpleFinAccountsResponse = serde_json::from_str(&body)
            .context("SimpleFIN accounts response was not valid JSON")?;
        parsed.normalize();
        Ok(parsed)
    }
}

pub struct SimpleFinProvider {
    http_client: Arc<dyn SimpleFinHttpClient>,
}

impl SimpleFinProvider {
    pub fn new(http_client: Arc<dyn SimpleFinHttpClient>) -> Self {
        Self { http_client }
    }

    pub async fn new_with_real_client() -> Result<Self> {
        let http_client = Arc::new(RealSimpleFinHttpClient::new()?);
        Ok(Self::new(http_client))
    }

    pub(crate) fn decode_setup_token(setup_token: &str) -> Result<String> {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(setup_token.trim())
            .context("setup token is not valid base64")?;
        String::from_utf8(decoded).context("setup token is not valid UTF-8")
    }

    pub(crate) fn is_beta_demo_setup_token(setup_token: &str) -> bool {
        Self::decode_setup_token(setup_token)
            .ok()
            .is_some_and(|claim_url| {
                claim_url.contains("beta-bridge.simplefin.org/simplefin/claim/DEMO")
            })
    }

    pub(crate) fn beta_demo_access_url_for_consumed_setup_token(
        setup_token: &str,
    ) -> Option<String> {
        if Self::is_beta_demo_setup_token(setup_token) {
            Some(BETA_DEMO_BRIDGE_ACCESS_URL.to_string())
        } else {
            None
        }
    }

    fn date_to_epoch_start(date: NaiveDate) -> i64 {
        Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0).expect("valid start of day"))
            .timestamp()
    }

    fn date_to_epoch_end_exclusive(date: NaiveDate) -> i64 {
        let next_day = date + Duration::days(1);
        Utc.from_utc_datetime(&next_day.and_hms_opt(0, 0, 0).expect("valid start of day"))
            .timestamp()
    }

    fn chunk_date_range(start_date: NaiveDate, end_date: NaiveDate) -> Vec<(NaiveDate, NaiveDate)> {
        let mut chunks = Vec::new();
        let mut chunk_start = start_date;
        while chunk_start <= end_date {
            let chunk_end = std::cmp::min(
                chunk_start + Duration::days(MAX_TRANSACTION_WINDOW_DAYS - 1),
                end_date,
            );
            chunks.push((chunk_start, chunk_end));
            chunk_start = chunk_end + Duration::days(1);
        }
        chunks
    }

    fn contains_any_keyword(text: &str, keywords: &[&str]) -> bool {
        keywords.iter().any(|kw| text.contains(kw))
    }

    fn extract_mask_from_name(account_name: &str) -> String {
        if let Some(start) = account_name.rfind('(') {
            if let Some(end) = account_name.rfind(')') {
                if start < end {
                    let mask_candidate = account_name[start + 1..end].trim();
                    if !mask_candidate.is_empty() {
                        return mask_candidate.to_string();
                    }
                }
            }
        }
        "0000".to_string()
    }

    fn scrub_account_name(account_name: &str) -> String {
        if let Some(start) = account_name.rfind('(') {
            if account_name.rfind(')').is_some_and(|end| start < end) {
                return account_name[..start].trim().to_string();
            }
        }
        account_name.to_string()
    }

    fn classify_account_type(account_name: &str, institution_name: Option<&str>) -> String {
        let name_lower = account_name.to_lowercase();
        let institution_lower = institution_name.map(|n| n.to_lowercase());

        const INVESTMENT_KEYWORDS: &[&str] = &[
            "ira",
            "roth",
            "401k",
            "401(k)",
            "403b",
            "403(b)",
            "keogh",
            "sep",
            "investment",
            "brokerage",
            "trading",
            "margin",
        ];
        const CREDIT_KEYWORDS: &[&str] = &[
            "credit",
            "visa",
            "mastercard",
            "amex",
            "american express",
            "discover",
            "card",
        ];
        const LOAN_KEYWORDS: &[&str] = &[
            "mortgage",
            "loan",
            "heloc",
            "home equity",
            "auto",
            "car",
            "student",
            "line of credit",
        ];

        if Self::contains_any_keyword(&name_lower, INVESTMENT_KEYWORDS) {
            return "investment".to_string();
        }

        if Self::contains_any_keyword(&name_lower, CREDIT_KEYWORDS) {
            return "credit".to_string();
        }

        if let Some(inst_name) = &institution_lower {
            if inst_name.contains("card") {
                return "credit".to_string();
            }
        }

        if Self::contains_any_keyword(&name_lower, LOAN_KEYWORDS) {
            return "loan".to_string();
        }

        "depository".to_string()
    }

    pub fn map_account(simplefin_account: &SimpleFinAccount) -> Account {
        let balance = simplefin_account
            .balance
            .as_deref()
            .and_then(|value| Decimal::from_str(value).ok());
        let institution_name = simplefin_account
            .org
            .as_ref()
            .and_then(|org| org.name.as_deref());
        let mask = Self::extract_mask_from_name(&simplefin_account.name);
        let scrubbed_name = Self::scrub_account_name(&simplefin_account.name);
        Account {
            id: Uuid::new_v4(),
            user_id: None,
            provider_account_id: Some(simplefin_account.id.clone()),
            provider_connection_id: None,
            name: scrubbed_name,
            account_type: Self::classify_account_type(&simplefin_account.name, institution_name),
            balance_current: balance,
            mask: Some(mask),
            institution_name: None,
            provider_conn_id: simplefin_account.org_conn_id(),
        }
    }

    pub fn map_transaction(
        simplefin_txn: &SimpleFinTransaction,
        account: &Account,
    ) -> Result<Transaction> {
        let amount = Decimal::from_str(&simplefin_txn.amount).unwrap_or(Decimal::ZERO);
        let date = if simplefin_txn.posted > 0 {
            Utc.timestamp_opt(simplefin_txn.posted, 0)
                .single()
                .map(|dt| dt.date_naive())
                .unwrap_or_else(|| Utc::now().date_naive())
        } else {
            Utc::now().date_naive()
        };

        Ok(Transaction {
            id: Uuid::new_v4(),
            account_id: account.id,
            user_id: None,
            provider_account_id: account.provider_account_id.clone(),
            provider_transaction_id: Some(simplefin_txn.id.clone()),
            amount,
            date,
            merchant_name: Some(simplefin_txn.description.clone()),
            category_primary: "OTHER".to_string(),
            category_detailed: "OTHER".to_string(),
            category_confidence: "LOW".to_string(),
            payment_channel: None,
            pending: simplefin_txn.pending,
            created_at: None,
        })
    }
}

#[async_trait]
impl FinancialDataProvider for SimpleFinProvider {
    fn provider_name(&self) -> &str {
        "simplefin"
    }

    async fn create_link_token(&self, _user_id: &Uuid) -> Result<String> {
        bail!("not yet implemented")
    }

    async fn exchange_public_token(&self, setup_token: &str) -> Result<ProviderCredentials> {
        let claim_url = Self::decode_setup_token(setup_token)?;
        let access_url = self.http_client.claim(&claim_url).await?;
        Ok(ProviderCredentials {
            provider: "simplefin".to_string(),
            access_token: access_url,
            item_id: "simplefin_root".to_string(),
            certificate: None,
            private_key: None,
        })
    }

    async fn fetch_balances_snapshot(
        &self,
        credentials: &ProviderCredentials,
    ) -> Result<Option<SimpleFinAccountsResponse>> {
        let today = Utc::now().date_naive();
        let three_months_ago = today
            .checked_sub_months(chrono::Months::new(3))
            .unwrap_or(today);

        let response = self
            .http_client
            .get_accounts(
                &credentials.access_token,
                AccountsQuery {
                    start_date: Some(Self::date_to_epoch_start(three_months_ago)),
                    end_date: Some(Self::date_to_epoch_end_exclusive(today)),
                    pending: true,
                    balances_only: false,
                    account_ids: Vec::new(),
                },
            )
            .await?;

        let messages = response.error_messages();
        if !messages.is_empty() {
            tracing::warn!(
                provider = "simplefin",
                bridge_errors = ?messages,
                "SimpleFIN bridge returned errors during snapshot"
            );
        }

        Ok(Some(response))
    }

    async fn get_accounts(&self, credentials: &ProviderCredentials) -> Result<Vec<Account>> {
        let response = self
            .fetch_balances_snapshot(credentials)
            .await?
            .ok_or_else(|| anyhow::anyhow!("SimpleFIN balances snapshot unavailable"))?;
        Ok(response.accounts.iter().map(Self::map_account).collect())
    }

    async fn get_transactions(
        &self,
        credentials: &ProviderCredentials,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<ProviderTransactionsResult> {
        let accounts = self.get_accounts(credentials).await?;
        let accounts_by_provider_id: std::collections::HashMap<String, Account> = accounts
            .into_iter()
            .filter_map(|account| {
                account
                    .provider_account_id
                    .clone()
                    .map(|provider_account_id| (provider_account_id, account))
            })
            .collect();
        let known_account_ids: Vec<String> = accounts_by_provider_id.keys().cloned().collect();

        tracing::info!(
            provider = "simplefin",
            start_date = %start_date,
            end_date = %end_date,
            mapped_account_count = known_account_ids.len(),
            mapped_account_ids = ?known_account_ids,
            "SimpleFIN get_transactions started"
        );

        let mut all_transactions = Vec::new();
        let chunks = Self::chunk_date_range(start_date, end_date);
        let page_count = chunks.len() as i32;
        for (chunk_start, chunk_end) in chunks {
            let response = self
                .http_client
                .get_accounts(
                    &credentials.access_token,
                    AccountsQuery {
                        start_date: Some(Self::date_to_epoch_start(chunk_start)),
                        end_date: Some(Self::date_to_epoch_end_exclusive(chunk_end)),
                        pending: true,
                        balances_only: false,
                        account_ids: Vec::new(),
                    },
                )
                .await?;

            let bridge_errors = response.error_messages();
            if !bridge_errors.is_empty() {
                tracing::warn!(
                    provider = "simplefin",
                    chunk_start = %chunk_start,
                    chunk_end = %chunk_end,
                    bridge_errors = ?bridge_errors,
                    "SimpleFIN bridge returned errors for transaction chunk"
                );
            }

            let mut chunk_mapped = 0usize;
            let mut chunk_bridge_txns = 0usize;
            let mut chunk_unmapped_accounts = 0usize;

            for simplefin_account in &response.accounts {
                chunk_bridge_txns += simplefin_account.transactions.len();
                let Some(account) = accounts_by_provider_id.get(&simplefin_account.id) else {
                    chunk_unmapped_accounts += 1;
                    tracing::warn!(
                        provider = "simplefin",
                        chunk_start = %chunk_start,
                        chunk_end = %chunk_end,
                        bridge_account_id = %simplefin_account.id,
                        bridge_account_name = %simplefin_account.name,
                        bridge_txn_count = simplefin_account.transactions.len(),
                        mapped_account_ids = ?known_account_ids,
                        "SimpleFIN bridge account not found in mapping table"
                    );
                    continue;
                };
                for simplefin_txn in &simplefin_account.transactions {
                    let transaction = Self::map_transaction(simplefin_txn, account)?;
                    if transaction.date >= start_date && transaction.date <= end_date {
                        all_transactions.push(transaction);
                        chunk_mapped += 1;
                    }
                }
            }

            tracing::info!(
                provider = "simplefin",
                chunk_start = %chunk_start,
                chunk_end = %chunk_end,
                bridge_account_count = response.accounts.len(),
                bridge_txn_count = chunk_bridge_txns,
                mapped_txn_count = chunk_mapped,
                unmapped_bridge_accounts = chunk_unmapped_accounts,
                "SimpleFIN transaction chunk fetched"
            );
        }

        tracing::info!(
            provider = "simplefin",
            start_date = %start_date,
            end_date = %end_date,
            total_mapped_txn_count = all_transactions.len(),
            chunk_count = page_count,
            "SimpleFIN get_transactions completed"
        );

        Ok(ProviderTransactionsResult {
            transactions: all_transactions,
            page_count,
        })
    }

    async fn get_institution_info(
        &self,
        _credentials: &ProviderCredentials,
    ) -> Result<InstitutionInfo> {
        Err(anyhow::Error::new(
            SimpleFinProviderError::NotApplicableForSimpleFin,
        ))
    }
}
