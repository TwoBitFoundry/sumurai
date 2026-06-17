use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::diy::CreateDiyAccountRequest;
use crate::models::plaid::ProviderConnection;
use crate::services::repository_service::DatabaseRepository;

pub struct DiyService {
    db_repository: Arc<dyn DatabaseRepository>,
}

impl DiyService {
    pub fn new(db_repository: Arc<dyn DatabaseRepository>) -> Self {
        Self { db_repository }
    }

    pub async fn create_institution(
        &self,
        user_id: Uuid,
        name: &str,
    ) -> Result<ProviderConnection> {
        let item_id = format!("diy_{}", Uuid::new_v4());
        let mut connection = ProviderConnection::new(user_id, &item_id);
        connection.provider = "diy".to_string();
        connection.institution_id = Some("diy".to_string());
        connection.mark_connected(name);
        self.db_repository
            .save_provider_connection(&connection)
            .await?;
        Ok(connection)
    }

    pub async fn create_account(
        &self,
        user_id: Uuid,
        connection_id: Uuid,
        req: &CreateDiyAccountRequest,
    ) -> Result<Account> {
        let connection = self
            .db_repository
            .get_provider_connection_by_id(&connection_id, &user_id)
            .await?;

        match connection {
            None => Err(anyhow!("not found")),
            Some(conn) if conn.provider != "diy" => Err(anyhow!("not diy")),
            Some(conn) => {
                let account = Account {
                    id: Uuid::new_v4(),
                    user_id: Some(user_id),
                    provider_account_id: Some(format!("diy_{}", Uuid::new_v4())),
                    provider_connection_id: Some(connection_id),
                    name: req.name.trim().to_string(),
                    account_type: req.account_type.clone(),
                    balance_current: req.balance,
                    mask: req.mask.clone(),
                    institution_name: conn.institution_name.clone(),
                    provider_conn_id: None,
                };
                self.db_repository.upsert_account(&account).await?;
                Ok(account)
            }
        }
    }
}
