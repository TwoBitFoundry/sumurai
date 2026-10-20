use std::sync::Arc;

use crate::config::Config;
use crate::providers::ProviderRegistry;
use crate::services::analytics_orchestrator::AnalyticsOrchestrator;
use crate::services::auto_categorization_orchestrator::AutoCategorizationOrchestrator;
use crate::services::budget_orchestrator::BudgetOrchestrator;
use crate::services::categorization::categorization_service::Categorizer;
use crate::services::category_management::service::CategoryManagementService;
use crate::services::category_orchestrator::CategoryOrchestrator;
use crate::services::diy_orchestrator::DiyOrchestrator;
use crate::services::diy_service::DiyService;
use crate::services::import_orchestrator::ImportOrchestrator;
use crate::services::otel_traces_relay::OtlpTracesRelay;
use crate::services::plaid_orchestrator::PlaidOrchestrator;
use crate::services::plaid_service::RealPlaidClient;
use crate::services::provider_sync_rate_limit_service::ProviderSyncRateLimitService;
use crate::services::repository_service::DatabaseRepository;
use crate::services::sync_service::SyncService;
use crate::services::sync_service_factory::SyncServiceFactory;
use crate::services::transaction_orchestrator::TransactionOrchestrator;
use crate::services::webauthn_service::WebAuthnService;
use crate::services::{
    AuthService, AuthorizationService, AutoCategorizationService, BudgetService, CacheService,
    ConnectionService,
};

pub struct AppState {
    pub(crate) plaid_client: Arc<RealPlaidClient>,
    pub(crate) sync_service: Arc<SyncService>,
    pub(crate) sync_service_factory: Arc<SyncServiceFactory>,
    pub(crate) analytics_service: Arc<crate::services::AnalyticsService>,
    pub(crate) budget_service: Arc<BudgetService>,
    pub(crate) authorization_service: Arc<AuthorizationService>,
    pub(crate) config: Config,
    pub(crate) db_repository: Arc<dyn DatabaseRepository>,
    pub(crate) cache_service: Arc<dyn CacheService>,
    pub(crate) provider_sync_rate_limit_service: Arc<ProviderSyncRateLimitService>,
    pub(crate) categorizer: Arc<dyn Categorizer>,
    pub(crate) connection_service: Arc<ConnectionService>,
    pub(crate) auth_service: Arc<AuthService>,
    pub(crate) provider_registry: Arc<ProviderRegistry>,
    pub(crate) otlp_traces_relay: Arc<OtlpTracesRelay>,
    pub(crate) category_management_service: Arc<CategoryManagementService>,
    pub(crate) auto_categorization_service: Arc<AutoCategorizationService>,
    pub(crate) webauthn_service: Arc<WebAuthnService>,
    pub(crate) diy_service: Arc<DiyService>,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            plaid_client: self.plaid_client.clone(),
            sync_service: self.sync_service.clone(),
            sync_service_factory: self.sync_service_factory.clone(),
            analytics_service: self.analytics_service.clone(),
            budget_service: self.budget_service.clone(),
            authorization_service: self.authorization_service.clone(),
            config: self.config.clone(),
            db_repository: self.db_repository.clone(),
            cache_service: self.cache_service.clone(),
            provider_sync_rate_limit_service: self.provider_sync_rate_limit_service.clone(),
            categorizer: self.categorizer.clone(),
            connection_service: self.connection_service.clone(),
            auth_service: self.auth_service.clone(),
            provider_registry: self.provider_registry.clone(),
            otlp_traces_relay: self.otlp_traces_relay.clone(),
            category_management_service: self.category_management_service.clone(),
            auto_categorization_service: self.auto_categorization_service.clone(),
            webauthn_service: self.webauthn_service.clone(),
            diy_service: self.diy_service.clone(),
        }
    }
}

impl AppState {
    pub fn analytics(&self) -> AnalyticsOrchestrator {
        AnalyticsOrchestrator::new(
            self.analytics_service.clone(),
            self.db_repository.clone(),
            self.cache_service.clone(),
            self.auth_service.clone(),
        )
    }

    pub fn auto_categorization(&self) -> AutoCategorizationOrchestrator {
        AutoCategorizationOrchestrator::new(self.auto_categorization_service.clone())
    }

    pub fn budgets(&self) -> BudgetOrchestrator {
        BudgetOrchestrator::new(
            self.budget_service.clone(),
            self.db_repository.clone(),
            self.cache_service.clone(),
        )
    }

    pub fn diy(&self) -> DiyOrchestrator {
        DiyOrchestrator::new(self.diy_service.clone(), self.connection_service.clone())
    }

    pub fn imports(&self) -> ImportOrchestrator {
        ImportOrchestrator::new(
            self.authorization_service.clone(),
            self.db_repository.clone(),
            self.cache_service.clone(),
        )
    }

    pub fn plaid(&self) -> PlaidOrchestrator {
        PlaidOrchestrator::new(
            self.connection_service.clone(),
            self.db_repository.clone(),
            self.cache_service.clone(),
        )
    }

    pub fn transactions(&self) -> TransactionOrchestrator {
        TransactionOrchestrator::new(self.db_repository.clone())
    }

    pub fn categories(&self) -> CategoryOrchestrator {
        CategoryOrchestrator::new(
            self.category_management_service.clone(),
            self.db_repository.clone(),
            self.cache_service.clone(),
        )
    }
}
