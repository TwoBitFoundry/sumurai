use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::models::analytics::{
    AnalyticsFilter, AnalyticsRange, BalanceCategory, BalancesOverviewResponse, BankTotals,
    BudgetSummary, CashFlowResponse, CategorySpending, DailySpending, DateBoundsResponse,
    IncomeExpenseTotals, MonthlySpending, NetWorthOverTimeResponse, NetWorthSeriesPoint,
    SankeyResponse, TopMerchant,
};
use crate::models::domain_error::DomainError;
use crate::services::repository_service::DatabaseRepository;
use crate::services::{AnalyticsService, AuthService, CacheService, SpendingTransactionQuery};
use crate::utils::cache_keys::generate_cache_key_with_account_filter;

const TOP_MERCHANTS_LIMIT: usize = 10;
const SANKEY_CACHE_TTL_SECONDS: u64 = 1800;
const FALLBACK_CACHE_TTL_SECONDS: u64 = 1800;
const REPORTING_CURRENCY: &str = "USD";

pub struct AnalyticsOrchestrator {
    analytics_service: Arc<AnalyticsService>,
    repository: Arc<dyn DatabaseRepository>,
    cache: Arc<dyn CacheService>,
    auth_service: Arc<AuthService>,
}

impl AnalyticsOrchestrator {
    pub fn new(
        analytics_service: Arc<AnalyticsService>,
        repository: Arc<dyn DatabaseRepository>,
        cache: Arc<dyn CacheService>,
        auth_service: Arc<AuthService>,
    ) -> Self {
        Self {
            analytics_service,
            repository,
            cache,
            auth_service,
        }
    }

    pub async fn current_month_spending(&self, user_id: Uuid) -> Result<Decimal, DomainError> {
        let (start_date, end_date) = self.analytics_service.current_month_date_range();
        let transactions = self
            .load_spending_transactions(user_id, Some(start_date), Some(end_date), None)
            .await?;
        Ok(self
            .analytics_service
            .calculate_current_month_spending(&transactions))
    }

    pub async fn daily_spending(
        &self,
        user_id: Uuid,
        year: i32,
        month: u32,
    ) -> Result<Vec<DailySpending>, DomainError> {
        let (start_date, end_date) = self
            .analytics_service
            .month_date_range(year, month)
            .ok_or_else(|| DomainError::bad_request("Invalid month"))?;
        let transactions = self
            .load_spending_transactions(user_id, Some(start_date), Some(end_date), None)
            .await?;
        Ok(self
            .analytics_service
            .calculate_daily_spending(&transactions, year, month))
    }

    pub async fn income_expense_totals(
        &self,
        user_id: Uuid,
        filter: AnalyticsFilter,
    ) -> Result<IncomeExpenseTotals, DomainError> {
        let account_ids = account_id_vec(filter.account_ids.as_ref());
        self.analytics_service
            .get_income_expense_totals(
                self.repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date: filter.start_date,
                    end_date: filter.end_date,
                    account_ids: account_ids.as_deref(),
                },
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get income and expense totals for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Failed to load income and expense totals")
            })
    }

    pub async fn budget_summary(
        &self,
        user_id: Uuid,
        filter: AnalyticsFilter,
    ) -> Result<BudgetSummary, DomainError> {
        let account_ids = account_id_vec(filter.account_ids.as_ref());
        self.analytics_service
            .get_budget_summary(
                self.repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date: filter.start_date,
                    end_date: filter.end_date,
                    account_ids: account_ids.as_deref(),
                },
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to get budget summary for user {}: {}", user_id, e);
                DomainError::internal("Failed to load budget summary")
            })
    }

    pub async fn spending_by_date_range(
        &self,
        user_id: Uuid,
        filter: AnalyticsFilter,
    ) -> Result<Decimal, DomainError> {
        let account_ids = account_id_vec(filter.account_ids.as_ref());
        let transactions = self
            .load_spending_transactions(
                user_id,
                filter.start_date,
                filter.end_date,
                account_ids.as_deref(),
            )
            .await?;
        Ok(transactions
            .into_iter()
            .filter(|t| t.amount < Decimal::ZERO)
            .map(|t| -t.amount)
            .sum())
    }

    pub async fn category_spending(
        &self,
        user_id: Uuid,
        filter: AnalyticsFilter,
    ) -> Result<Vec<CategorySpending>, DomainError> {
        let account_ids = account_id_vec(filter.account_ids.as_ref());
        self.analytics_service
            .get_category_spending(
                self.repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date: filter.start_date,
                    end_date: filter.end_date,
                    account_ids: account_ids.as_deref(),
                },
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get category spending for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Failed to load category spending")
            })
    }

    pub async fn monthly_totals(
        &self,
        user_id: Uuid,
        range: AnalyticsRange,
    ) -> Result<Vec<MonthlySpending>, DomainError> {
        let AnalyticsRange {
            start_date,
            end_date,
            account_ids,
        } = range;
        let account_ids = account_id_vec(account_ids.as_ref());
        let transactions = self
            .load_spending_transactions(
                user_id,
                Some(start_date),
                Some(end_date),
                account_ids.as_deref(),
            )
            .await?;
        Ok(self.analytics_service.calculate_monthly_totals(
            &transactions,
            self.analytics_service
                .inclusive_month_count(start_date, end_date),
        ))
    }

    pub async fn date_bounds(
        &self,
        user_id: Uuid,
        account_ids: Option<HashSet<Uuid>>,
    ) -> Result<DateBoundsResponse, DomainError> {
        let account_ids = account_id_vec(account_ids.as_ref());
        self.analytics_service
            .get_date_bounds(self.repository.as_ref(), &user_id, account_ids.as_deref())
            .await
            .map_err(|error| {
                tracing::error!(
                    "Failed to get analytics date bounds for user {}: {}",
                    user_id,
                    error
                );
                DomainError::internal("Failed to load analytics date bounds")
            })
    }

    pub async fn cash_flow(
        &self,
        user_id: Uuid,
        range: AnalyticsRange,
    ) -> Result<CashFlowResponse, DomainError> {
        let AnalyticsRange {
            start_date,
            end_date,
            account_ids,
        } = range;
        let account_ids = account_id_vec(account_ids.as_ref());

        if matches!(account_ids.as_deref(), Some([])) {
            return Ok(CashFlowResponse {
                series: Vec::new(),
                currency: REPORTING_CURRENCY.to_string(),
            });
        }

        let aggregates = self
            .repository
            .get_monthly_cash_flow_aggregates_for_user(
                &user_id,
                start_date,
                end_date,
                account_ids.as_deref(),
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get cash flow aggregates for user {} in range [{}, {}]: {}",
                    user_id,
                    start_date,
                    end_date,
                    e
                );
                DomainError::internal("Failed to load cash flow")
            })?;

        let series = self.analytics_service.cash_flow_from_monthly_aggregates(
            &aggregates,
            self.analytics_service
                .inclusive_month_count(start_date, end_date),
        );
        Ok(CashFlowResponse {
            series,
            currency: REPORTING_CURRENCY.to_string(),
        })
    }

    pub async fn sankey(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        range: AnalyticsRange,
    ) -> Result<SankeyResponse, DomainError> {
        let AnalyticsRange {
            start_date,
            end_date,
            account_ids: authorized_account_ids,
        } = range;
        let accounts = self
            .repository
            .get_accounts_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch accounts for sankey: {}", e);
                DomainError::internal("Failed to load accounts")
            })?;

        let mut allowed_account_ids: HashSet<Uuid> = HashSet::new();
        for account in accounts {
            if let Some(ref filtered_ids) = authorized_account_ids {
                if !filtered_ids.contains(&account.id) {
                    continue;
                }
            }

            let category =
                AnalyticsService::map_account_to_balance_category(&account.account_type, None);
            if matches!(
                category,
                BalanceCategory::Loan | BalanceCategory::Investments
            ) {
                continue;
            }

            allowed_account_ids.insert(account.id);
        }

        if allowed_account_ids.is_empty() {
            return Ok(self.analytics_service.build_sankey(
                Decimal::ZERO,
                Vec::new(),
                REPORTING_CURRENCY,
            ));
        }

        let base_cache_key = format!("{}_sankey_{}_{}", jwt_id, start_date, end_date);
        let cache_key =
            generate_cache_key_with_account_filter(&base_cache_key, Some(&allowed_account_ids));

        if let Ok(Some(serialized)) = self.cache.get_string(&cache_key).await {
            if let Ok(cached) = serde_json::from_str::<SankeyResponse>(&serialized) {
                return Ok(cached);
            }
        }

        let allowed_account_ids_vec: Vec<Uuid> = allowed_account_ids.iter().copied().collect();
        let aggregates = self
            .repository
            .get_monthly_cash_flow_aggregates_for_user(
                &user_id,
                start_date,
                end_date,
                Some(&allowed_account_ids_vec),
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to get sankey income aggregates: {}", e);
                DomainError::internal("Failed to load sankey income")
            })?;
        let income: Decimal = aggregates.iter().map(|aggregate| aggregate.income).sum();

        let transactions = self
            .analytics_service
            .load_spending_transactions(
                self.repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date: Some(start_date),
                    end_date: Some(end_date),
                    account_ids: Some(&allowed_account_ids_vec),
                },
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to get sankey spending transactions: {}", e);
                DomainError::internal("Failed to load sankey transactions")
            })?;
        let categories = self.analytics_service.group_by_category_with_date_range(
            &transactions,
            Some(start_date),
            Some(end_date),
        );

        let response = self
            .analytics_service
            .build_sankey(income, categories, REPORTING_CURRENCY);

        if let Ok(serialized) = serde_json::to_string(&response) {
            let _ = self
                .cache
                .set_with_ttl(&cache_key, &serialized, SANKEY_CACHE_TTL_SECONDS)
                .await;
        }

        Ok(response)
    }

    pub async fn top_merchants(
        &self,
        user_id: Uuid,
        filter: AnalyticsFilter,
    ) -> Result<Vec<TopMerchant>, DomainError> {
        let account_ids = account_id_vec(filter.account_ids.as_ref());
        let transactions = self
            .load_spending_transactions(
                user_id,
                filter.start_date,
                filter.end_date,
                account_ids.as_deref(),
            )
            .await?;
        Ok(self
            .analytics_service
            .get_top_merchants(&transactions, TOP_MERCHANTS_LIMIT))
    }

    pub async fn balances_overview(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        authorized_account_ids: Option<HashSet<Uuid>>,
    ) -> Result<BalancesOverviewResponse, DomainError> {
        let base_cache_key = format!("{}_balances_overview", jwt_id);
        let cache_key = generate_cache_key_with_account_filter(
            &base_cache_key,
            authorized_account_ids.as_ref(),
        );
        if let Ok(Some(serialized)) = self.cache.get_string(&cache_key).await {
            if let Ok(cached) = serde_json::from_str::<BalancesOverviewResponse>(&serialized) {
                return Ok(cached);
            }
        }

        let latest_rows = self
            .repository
            .get_latest_account_balances_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch latest account balances: {}", e);
                DomainError::internal("Failed to load account balances")
            })?;

        type LatestMapValue = (String, Option<String>, String, Decimal);
        let mut latest_map: HashMap<String, Vec<LatestMapValue>> = HashMap::new();
        let mut name_map: HashMap<String, String> = HashMap::new();
        let mut mixed_currency = false;
        for row in latest_rows.into_iter() {
            if let Some(ref filter_ids) = authorized_account_ids {
                if !filter_ids.contains(&row.account_id) {
                    continue;
                }
            }
            if row.currency.to_uppercase() != "USD" {
                mixed_currency = true;
                continue;
            }
            if let Some(ref inst_name) = row.institution_name {
                name_map
                    .entry(row.institution_id.clone())
                    .or_insert(inst_name.clone());
            }
            latest_map.entry(row.institution_id).or_default().push((
                row.account_type,
                row.account_subtype,
                row.currency,
                row.current_balance,
            ));
        }

        if latest_map.is_empty() {
            let accounts = self
                .repository
                .get_accounts_for_user(&user_id)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to fetch accounts for fallback: {}", e);
                    DomainError::internal("Failed to load accounts")
                })?;
            for acc in accounts.into_iter() {
                if let Some(ref filter_ids) = authorized_account_ids {
                    if !filter_ids.contains(&acc.id) {
                        continue;
                    }
                }
                let bal = acc.balance_current.unwrap_or(Decimal::ZERO);
                latest_map
                    .entry("unknown_institution".to_string())
                    .or_default()
                    .push((acc.account_type, None, "USD".to_string(), bal));
            }
        }

        let mut overall_cash = Decimal::ZERO;
        let mut overall_credit = Decimal::ZERO;
        let mut overall_loan = Decimal::ZERO;
        let mut overall_investments = Decimal::ZERO;
        let mut banks: Vec<BankTotals> = Vec::new();

        for (bank_id, accounts) in latest_map.iter() {
            let mut cash = Decimal::ZERO;
            let mut credit = Decimal::ZERO;
            let mut loan = Decimal::ZERO;
            let mut investments = Decimal::ZERO;

            for (account_type, account_subtype, _currency, balance) in accounts.iter() {
                let category = AnalyticsService::map_account_to_balance_category(
                    account_type,
                    account_subtype.as_deref(),
                );
                match category {
                    BalanceCategory::Cash => {
                        cash += *balance;
                    }
                    BalanceCategory::Investments => {
                        investments += *balance;
                    }
                    BalanceCategory::Credit => {
                        credit += -balance.abs();
                    }
                    BalanceCategory::Loan => {
                        loan += -balance.abs();
                    }
                }
            }

            let totals = crate::models::analytics::finalize_totals(cash, credit, loan, investments);

            let bank_name = name_map
                .get(bank_id)
                .cloned()
                .unwrap_or_else(|| bank_id.clone());
            banks.push(BankTotals {
                bank_id: bank_id.clone(),
                bank_name,
                totals: totals.clone(),
            });

            overall_cash += cash;
            overall_credit += credit;
            overall_loan += loan;
            overall_investments += investments;
        }

        let overall = crate::models::analytics::finalize_totals(
            overall_cash,
            overall_credit,
            overall_loan,
            overall_investments,
        );
        let response = BalancesOverviewResponse {
            as_of: "latest".to_string(),
            overall,
            banks,
            mixed_currency,
        };

        if let Ok(serialized) = serde_json::to_string(&response) {
            let ttl_seconds = self.session_cache_ttl(jwt_id).await;
            let _ = self
                .cache
                .set_with_ttl(&cache_key, &serialized, ttl_seconds)
                .await;
        }

        tracing::info!(
            account_count = response.banks.len(),
            "Data access: balances"
        );

        Ok(response)
    }

    pub async fn net_worth_over_time(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        range: AnalyticsRange,
    ) -> Result<NetWorthOverTimeResponse, DomainError> {
        let AnalyticsRange {
            start_date,
            end_date,
            account_ids: authorized_account_ids,
        } = range;
        let base_cache_key = format!("{}_net_worth_over_time_{}_{}", jwt_id, start_date, end_date);
        let cache_key = generate_cache_key_with_account_filter(
            &base_cache_key,
            authorized_account_ids.as_ref(),
        );
        if let Ok(Some(serialized)) = self.cache.get_string(&cache_key).await {
            if let Ok(cached) = serde_json::from_str::<NetWorthOverTimeResponse>(&serialized) {
                return Ok(cached);
            }
        }

        let accounts = self
            .repository
            .get_accounts_for_user(&user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch accounts: {}", e);
                DomainError::internal("Failed to load accounts")
            })?;

        let mut depository_ids: HashSet<Uuid> = HashSet::new();
        let mut balance_current_by_id: HashMap<Uuid, Decimal> = HashMap::new();
        for acc in accounts.into_iter() {
            if let Some(ref allowed_ids) = authorized_account_ids {
                if !allowed_ids.contains(&acc.id) {
                    continue;
                }
            }
            if acc.account_type.to_lowercase() == "depository" {
                depository_ids.insert(acc.id);
                balance_current_by_id
                    .entry(acc.id)
                    .or_insert(acc.balance_current.unwrap_or(Decimal::ZERO));
            }
        }

        if depository_ids.is_empty() {
            return Ok(NetWorthOverTimeResponse {
                series: Vec::new(),
                currency: REPORTING_CURRENCY.to_string(),
            });
        }

        let today = chrono::Utc::now().naive_utc().date();
        let end_anchor = std::cmp::min(end_date, today);

        let txns = self
            .repository
            .get_transactions_by_date_range_for_user(&user_id, start_date, today)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch transactions for ledger: {}", e);
                DomainError::internal("Failed to load ledger transactions")
            })?;

        let mut flows_by_account: HashMap<Uuid, BTreeMap<NaiveDate, Decimal>> = HashMap::new();
        for t in txns.into_iter() {
            if let Some(ref allowed_ids) = authorized_account_ids {
                if !allowed_ids.contains(&t.account_id) {
                    continue;
                }
            }
            if !depository_ids.contains(&t.account_id) {
                continue;
            }
            flows_by_account
                .entry(t.account_id)
                .or_default()
                .entry(t.date)
                .and_modify(|v| *v += t.amount)
                .or_insert(t.amount);
        }

        let mut base_start_by_account: HashMap<Uuid, Decimal> = HashMap::new();
        for acc_id in depository_ids.iter() {
            let current_balance = *balance_current_by_id.get(acc_id).unwrap_or(&Decimal::ZERO);
            let mut rollback_sum = Decimal::ZERO;
            if let Some(map) = flows_by_account.get(acc_id) {
                for (_, amt) in map.range((start_date.succ_opt().unwrap_or(start_date))..=today) {
                    rollback_sum += *amt;
                }
            }
            base_start_by_account.insert(*acc_id, current_balance - rollback_sum);
        }

        let mut series: Vec<NetWorthSeriesPoint> = Vec::new();
        let mut day = start_date;
        let mut per_account_cum: HashMap<Uuid, Decimal> = HashMap::new();
        while day <= end_date {
            if day <= end_anchor {
                for (acc_id, fmap) in flows_by_account.iter() {
                    let acc_entry = per_account_cum.entry(*acc_id).or_insert(Decimal::ZERO);
                    if let Some(amt) = fmap.get(&day) {
                        *acc_entry += *amt;
                    }
                }
            }
            let mut total = Decimal::ZERO;
            for acc_id in depository_ids.iter() {
                let base = *base_start_by_account.get(acc_id).unwrap_or(&Decimal::ZERO);
                let delta = *per_account_cum.get(acc_id).unwrap_or(&Decimal::ZERO);
                total += base + delta;
            }
            series.push(NetWorthSeriesPoint {
                date: day.format("%Y-%m-%d").to_string(),
                value: total,
            });

            day = day.succ_opt().unwrap_or(day);
            if day > end_date {
                break;
            }
        }

        let response = NetWorthOverTimeResponse {
            series,
            currency: REPORTING_CURRENCY.to_string(),
        };

        if let Ok(serialized) = serde_json::to_string(&response) {
            let ttl_seconds = self.session_cache_ttl(jwt_id).await;
            let _ = self
                .cache
                .set_with_ttl(&cache_key, &serialized, ttl_seconds)
                .await;
        }

        Ok(response)
    }

    async fn load_spending_transactions(
        &self,
        user_id: Uuid,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        account_ids: Option<&[Uuid]>,
    ) -> Result<Vec<crate::models::transaction::Transaction>, DomainError> {
        self.analytics_service
            .load_spending_transactions(
                self.repository.as_ref(),
                &user_id,
                SpendingTransactionQuery {
                    start_date,
                    end_date,
                    account_ids,
                },
            )
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to get spending transactions for user {}: {}",
                    user_id,
                    e
                );
                DomainError::internal("Failed to load spending transactions")
            })
    }

    async fn session_cache_ttl(&self, jwt_id: &str) -> u64 {
        let mut ttl_seconds: u64 = FALLBACK_CACHE_TTL_SECONDS;
        if let Ok(Some(jwt_token)) = self.cache.get_jwt_token(jwt_id).await {
            if let Ok(claims) = self.auth_service.validate_token(&jwt_token) {
                let now = chrono::Utc::now().timestamp() as usize;
                if claims.exp > now {
                    ttl_seconds = (claims.exp - now) as u64;
                }
            }
        }
        ttl_seconds
    }
}

fn account_id_vec(account_ids: Option<&HashSet<Uuid>>) -> Option<Vec<Uuid>> {
    account_ids.map(|ids| ids.iter().copied().collect())
}
