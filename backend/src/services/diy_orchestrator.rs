use std::sync::Arc;

use uuid::Uuid;

use crate::models::account::Account;
use crate::models::diy::CreateDiyAccountRequest;
use crate::models::domain_error::DomainError;
use crate::models::plaid::{DisconnectResult, ProviderConnection};
use crate::services::connection_service::ConnectionService;
use crate::services::diy_service::DiyService;

pub const DIY_VALID_ACCOUNT_TYPES: &[&str] = &["depository", "credit", "investment", "loan"];

pub struct DiyOrchestrator {
    diy_service: Arc<DiyService>,
    connection_service: Arc<ConnectionService>,
}

impl DiyOrchestrator {
    pub fn new(diy_service: Arc<DiyService>, connection_service: Arc<ConnectionService>) -> Self {
        Self {
            diy_service,
            connection_service,
        }
    }

    pub async fn create_institution(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        name: &str,
    ) -> Result<ProviderConnection, DomainError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(DomainError::bad_request("Institution name cannot be empty"));
        }

        self.diy_service
            .create_institution(user_id, jwt_id, name)
            .await
            .map_err(|e| {
                if e.to_string().contains("already exists") {
                    DomainError::conflict("Institution name already exists")
                } else {
                    tracing::error!(
                        "Failed to create DIY institution for user {}: {}",
                        user_id,
                        e
                    );
                    DomainError::internal("Failed to create institution")
                }
            })
    }

    pub async fn create_account(
        &self,
        user_id: Uuid,
        connection_id: Uuid,
        req: &CreateDiyAccountRequest,
    ) -> Result<Account, DomainError> {
        if req.name.trim().is_empty() {
            return Err(DomainError::bad_request("Account name cannot be empty"));
        }

        if !DIY_VALID_ACCOUNT_TYPES.contains(&req.account_type.as_str()) {
            return Err(Self::invalid_account_type());
        }

        if req.balance.is_none() {
            return Err(DomainError::bad_request("Balance is required"));
        }

        self.diy_service
            .create_account(user_id, connection_id, req)
            .await
            .map_err(|e| {
                let message = e.to_string();
                if message.contains("not found") {
                    DomainError::not_found("Connection not found")
                } else if message.contains("not diy") {
                    DomainError::forbidden("Connection is not a DIY connection")
                } else if message.contains("account name already exists") {
                    DomainError::conflict("Account name already exists in this institution")
                } else if message.contains("account mask already exists") {
                    DomainError::conflict("Account mask already exists in this institution")
                } else {
                    tracing::error!(
                        "Failed to create DIY account for user {} connection {}: {}",
                        user_id,
                        connection_id,
                        e
                    );
                    DomainError::internal("Failed to create account")
                }
            })
    }

    pub async fn disconnect(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        connection_id: Uuid,
    ) -> Result<DisconnectResult, DomainError> {
        let connection = match self
            .diy_service
            .require_diy_institution(user_id, connection_id)
            .await
        {
            Ok(connection) => connection,
            Err(e) if e.to_string().contains("not found") => {
                return Err(DomainError::not_found("Institution not found"));
            }
            Err(e) if e.to_string().contains("not diy") => {
                return Err(DomainError::forbidden(
                    "Connection is not a DIY institution",
                ));
            }
            Err(e) => {
                tracing::error!(
                    "Failed to resolve DIY institution {} for user {}: {}",
                    connection_id,
                    user_id,
                    e
                );
                return Err(DomainError::internal("Failed to disconnect institution"));
            }
        };

        match self
            .connection_service
            .disconnect_owned_connection(&connection, &user_id, jwt_id)
            .await
        {
            Ok(result) if result.success => Ok(result),
            Ok(_) => Err(DomainError::not_found("Institution not found")),
            Err(e) => {
                tracing::error!(
                    "Failed to disconnect DIY institution {} for user {}: {}",
                    connection_id,
                    user_id,
                    e
                );
                Err(DomainError::internal("Failed to disconnect institution"))
            }
        }
    }

    fn invalid_account_type() -> DomainError {
        DomainError::bad_request(format!(
            "account_type must be one of: {}",
            DIY_VALID_ACCOUNT_TYPES.join(", ")
        ))
    }
}
