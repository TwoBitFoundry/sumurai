use std::sync::Arc;

use uuid::Uuid;

use crate::models::account::Account;
use crate::models::diy::CreateDiyAccountRequest;
use crate::models::plaid::{DisconnectResult, ProviderConnection};
use crate::services::connection_service::ConnectionService;
use crate::services::diy_service::DiyService;

pub const DIY_VALID_ACCOUNT_TYPES: &[&str] = &["depository", "credit", "investment", "loan"];

#[derive(Debug, Clone, PartialEq)]
pub enum DiyOrchestrationError {
    EmptyInstitutionName,
    InstitutionNameTaken,
    CreateInstitutionFailed,
    EmptyAccountName,
    InvalidAccountType,
    BalanceRequired,
    ConnectionNotFound,
    ConnectionNotDiy,
    AccountNameTaken,
    AccountMaskTaken,
    CreateAccountFailed,
    InstitutionNotFound,
    NotDiyInstitution,
    ResolveInstitutionFailed,
    DisconnectFailed,
}

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
    ) -> Result<ProviderConnection, DiyOrchestrationError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(DiyOrchestrationError::EmptyInstitutionName);
        }

        self.diy_service
            .create_institution(user_id, jwt_id, name)
            .await
            .map_err(|e| {
                if e.to_string().contains("already exists") {
                    DiyOrchestrationError::InstitutionNameTaken
                } else {
                    tracing::error!(
                        "Failed to create DIY institution for user {}: {}",
                        user_id,
                        e
                    );
                    DiyOrchestrationError::CreateInstitutionFailed
                }
            })
    }

    pub async fn create_account(
        &self,
        user_id: Uuid,
        connection_id: Uuid,
        req: &CreateDiyAccountRequest,
    ) -> Result<Account, DiyOrchestrationError> {
        if req.name.trim().is_empty() {
            return Err(DiyOrchestrationError::EmptyAccountName);
        }

        if !DIY_VALID_ACCOUNT_TYPES.contains(&req.account_type.as_str()) {
            return Err(DiyOrchestrationError::InvalidAccountType);
        }

        if req.balance.is_none() {
            return Err(DiyOrchestrationError::BalanceRequired);
        }

        self.diy_service
            .create_account(user_id, connection_id, req)
            .await
            .map_err(|e| {
                let message = e.to_string();
                if message.contains("not found") {
                    DiyOrchestrationError::ConnectionNotFound
                } else if message.contains("not diy") {
                    DiyOrchestrationError::ConnectionNotDiy
                } else if message.contains("account name already exists") {
                    DiyOrchestrationError::AccountNameTaken
                } else if message.contains("account mask already exists") {
                    DiyOrchestrationError::AccountMaskTaken
                } else {
                    tracing::error!(
                        "Failed to create DIY account for user {} connection {}: {}",
                        user_id,
                        connection_id,
                        e
                    );
                    DiyOrchestrationError::CreateAccountFailed
                }
            })
    }

    pub async fn disconnect(
        &self,
        user_id: Uuid,
        jwt_id: &str,
        connection_id: Uuid,
    ) -> Result<DisconnectResult, DiyOrchestrationError> {
        let connection = match self
            .diy_service
            .require_diy_institution(user_id, connection_id)
            .await
        {
            Ok(connection) => connection,
            Err(e) if e.to_string().contains("not found") => {
                return Err(DiyOrchestrationError::InstitutionNotFound);
            }
            Err(e) if e.to_string().contains("not diy") => {
                return Err(DiyOrchestrationError::NotDiyInstitution);
            }
            Err(e) => {
                tracing::error!(
                    "Failed to resolve DIY institution {} for user {}: {}",
                    connection_id,
                    user_id,
                    e
                );
                return Err(DiyOrchestrationError::ResolveInstitutionFailed);
            }
        };

        match self
            .connection_service
            .disconnect_owned_connection(&connection, &user_id, jwt_id)
            .await
        {
            Ok(result) if result.success => Ok(result),
            Ok(_) => Err(DiyOrchestrationError::InstitutionNotFound),
            Err(e) => {
                tracing::error!(
                    "Failed to disconnect DIY institution {} for user {}: {}",
                    connection_id,
                    user_id,
                    e
                );
                Err(DiyOrchestrationError::DisconnectFailed)
            }
        }
    }
}
