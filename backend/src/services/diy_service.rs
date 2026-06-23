use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::account::Account;
use crate::models::diy::CreateDiyAccountRequest;
use crate::models::plaid::ProviderConnection;
use crate::services::connection_service::ConnectionService;
use crate::services::repository_service::DatabaseRepository;

pub struct DiyService {
    db_repository: Arc<dyn DatabaseRepository>,
    connection_service: Arc<ConnectionService>,
}

impl DiyService {
    pub fn new(
        db_repository: Arc<dyn DatabaseRepository>,
        connection_service: Arc<ConnectionService>,
    ) -> Self {
        Self {
            db_repository,
            connection_service,
        }
    }

    pub async fn create_institution(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        name: &str,
    ) -> Result<ProviderConnection> {
        self.connection_service
            .exit_demo_mode_before_new_institution(&user_id, jwt_id)
            .await?;

        let normalized_name = name.trim();
        let connections = self
            .db_repository
            .get_all_provider_connections_by_user(&user_id)
            .await?;

        let name_taken = connections.iter().any(|connection| {
            connection
                .institution_name
                .as_deref()
                .is_some_and(|existing_name| {
                    existing_name.trim().eq_ignore_ascii_case(normalized_name)
                })
        });

        if name_taken {
            return Err(anyhow!("institution name already exists"));
        }

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
                let institution_accounts = self
                    .db_repository
                    .get_accounts_for_user(&user_id)
                    .await?
                    .into_iter()
                    .filter(|account| account.provider_connection_id == Some(connection_id))
                    .collect::<Vec<_>>();

                let normalized_name = req.name.trim();
                if institution_accounts
                    .iter()
                    .any(|account| account.name.trim().eq_ignore_ascii_case(normalized_name))
                {
                    return Err(anyhow!("account name already exists"));
                }

                if let Some(mask) = req
                    .mask
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    let mask_taken = institution_accounts.iter().any(|account| {
                        account
                            .mask
                            .as_deref()
                            .map(str::trim)
                            .is_some_and(|existing_mask| {
                                !existing_mask.is_empty()
                                    && existing_mask.eq_ignore_ascii_case(mask)
                            })
                    });

                    if mask_taken {
                        return Err(anyhow!("account mask already exists"));
                    }
                }

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

    pub async fn require_diy_institution(
        &self,
        user_id: Uuid,
        connection_id: Uuid,
    ) -> Result<ProviderConnection> {
        let connection = self
            .db_repository
            .get_provider_connection_by_id(&connection_id, &user_id)
            .await?
            .ok_or_else(|| anyhow!("not found"))?;

        if connection.provider != "diy" {
            return Err(anyhow!("not diy"));
        }

        Ok(connection)
    }
}
