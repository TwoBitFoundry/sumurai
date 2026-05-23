use std::collections::HashMap;
use std::sync::Arc;

use crate::services::connection_service::ConnectionService;
use crate::services::sync_service::SyncService;
use crate::services::sync_service_dispatcher::{
    PlaidSyncDispatcher, SimpleFinSyncDispatcher, SyncServiceDispatcher, TellerSyncDispatcher,
};

pub struct SyncServiceFactory {
    dispatchers: HashMap<String, Arc<dyn SyncServiceDispatcher>>,
}

impl SyncServiceFactory {
    pub fn new(connection_service: Arc<ConnectionService>, sync_service: Arc<SyncService>) -> Self {
        let plaid: Arc<dyn SyncServiceDispatcher> = Arc::new(PlaidSyncDispatcher::new(
            connection_service.clone(),
            sync_service.clone(),
        ));
        let teller: Arc<dyn SyncServiceDispatcher> =
            Arc::new(TellerSyncDispatcher::new(connection_service.clone()));
        let simplefin: Arc<dyn SyncServiceDispatcher> = Arc::new(SimpleFinSyncDispatcher::new(
            connection_service,
            sync_service,
        ));

        let mut dispatchers = HashMap::new();
        dispatchers.insert("plaid".to_string(), plaid);
        dispatchers.insert("teller".to_string(), teller);
        dispatchers.insert("simplefin".to_string(), simplefin);

        Self { dispatchers }
    }

    pub fn get_dispatcher(&self, provider: &str) -> Option<Arc<dyn SyncServiceDispatcher>> {
        self.dispatchers.get(provider).cloned()
    }
}
