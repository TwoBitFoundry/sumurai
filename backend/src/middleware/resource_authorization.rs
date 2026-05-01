use crate::models::app_state::AppState;
use crate::models::{
    analytics::{BalancesOverviewQuery, DateRangeQuery, MonthlyTotalsQuery},
    api_error::ApiErrorResponse,
    auth::AuthContext,
    plaid::{DisconnectRequest, ProviderConnection, SyncTransactionsRequest},
    transaction::TransactionsQuery,
};
use axum::{
    extract::{FromRequest, FromRequestParts, Json, Path, Query, Request},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
};
use serde::de::DeserializeOwned;
use std::collections::HashSet;
use uuid::Uuid;

pub trait AccountIdsQuery {
    fn account_ids(&self) -> &[String];
}

pub trait ConnectionIdRequest {
    fn connection_id(&self) -> Option<&str>;
}

pub struct AuthorizedQuery<T> {
    pub query: T,
    pub authorized_account_ids: Option<HashSet<Uuid>>,
}

pub struct AuthorizedConnectionRequest<T> {
    pub _body: T,
    pub connection: ProviderConnection,
}

pub struct AuthorizedBudgetId {
    pub budget_id: Uuid,
}

fn error_response(status: StatusCode, code: &str, message: &str) -> Response {
    ApiErrorResponse::with_code(code, message, code)
        .into_response(status)
        .into_response()
}

fn bad_request(message: &str) -> Response {
    error_response(StatusCode::BAD_REQUEST, "BAD_REQUEST", message)
}

fn unauthorized(message: &str) -> Response {
    error_response(StatusCode::UNAUTHORIZED, "UNAUTHORIZED", message)
}

fn not_found(message: &str) -> Response {
    error_response(StatusCode::NOT_FOUND, "NOT_FOUND", message)
}

fn forbidden(message: &str) -> Response {
    error_response(StatusCode::FORBIDDEN, "FORBIDDEN", message)
}

async fn validate_account_ids(
    state: &AppState,
    auth_context: &AuthContext,
    account_id_strings: &[String],
) -> Result<Option<HashSet<Uuid>>, Response> {
    if account_id_strings.is_empty() {
        return Ok(None);
    }

    let validated_ids = state
        .authorization_service
        .validate_account_ownership(
            account_id_strings,
            &auth_context.user_id,
            state.db_repository.as_ref(),
        )
        .await
        .map_err(|status| match status {
            StatusCode::BAD_REQUEST => bad_request("Invalid account filter"),
            StatusCode::FORBIDDEN => forbidden("Account filter references another user"),
            _ => error_response(status, "INTERNAL_SERVER_ERROR", "Authorization failed"),
        })?;

    Ok(Some(validated_ids.into_iter().collect()))
}

fn auth_context_from_parts(parts: &Parts) -> Result<AuthContext, StatusCode> {
    parts
        .extensions
        .get::<AuthContext>()
        .cloned()
        .ok_or(StatusCode::UNAUTHORIZED)
}

impl AccountIdsQuery for TransactionsQuery {
    fn account_ids(&self) -> &[String] {
        &self.account_ids
    }
}

impl AccountIdsQuery for DateRangeQuery {
    fn account_ids(&self) -> &[String] {
        &self.account_ids
    }
}

impl AccountIdsQuery for MonthlyTotalsQuery {
    fn account_ids(&self) -> &[String] {
        &self.account_ids
    }
}

impl AccountIdsQuery for BalancesOverviewQuery {
    fn account_ids(&self) -> &[String] {
        &self.account_ids
    }
}

impl ConnectionIdRequest for SyncTransactionsRequest {
    fn connection_id(&self) -> Option<&str> {
        self.connection_id.as_deref()
    }
}

impl ConnectionIdRequest for DisconnectRequest {
    fn connection_id(&self) -> Option<&str> {
        Some(&self.connection_id)
    }
}

impl FromRequestParts<AppState> for AuthorizedBudgetId {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_context = auth_context_from_parts(parts)
            .map_err(|_| unauthorized("Authentication required"))?;
        let Path(budget_id) = Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map_err(|_| bad_request("Invalid budget id"))?;

        state
            .authorization_service
            .require_budget_owned(
                &budget_id,
                &auth_context.user_id,
                state.db_repository.as_ref(),
            )
            .await
            .map_err(|status| match status {
                StatusCode::NOT_FOUND => not_found("Budget not found"),
                _ => error_response(status, "INTERNAL_SERVER_ERROR", "Authorization failed"),
            })?;

        Ok(Self { budget_id })
    }
}

impl<T> FromRequestParts<AppState> for AuthorizedQuery<T>
where
    T: DeserializeOwned + AccountIdsQuery + Send,
{
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_context = auth_context_from_parts(parts)
            .map_err(|_| unauthorized("Authentication required"))?;
        let Query(query) = Query::<T>::from_request_parts(parts, state)
            .await
            .map_err(|_| bad_request("Invalid query parameters"))?;
        let account_ids = query.account_ids().to_vec();
        let authorized_account_ids =
            validate_account_ids(state, &auth_context, &account_ids).await?;

        Ok(Self {
            query,
            authorized_account_ids,
        })
    }
}

impl<T> FromRequest<AppState> for AuthorizedConnectionRequest<T>
where
    T: DeserializeOwned + ConnectionIdRequest + Send,
{
    type Rejection = Response;

    async fn from_request(req: Request, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_context = req
            .extensions()
            .get::<AuthContext>()
            .cloned()
            .ok_or_else(|| unauthorized("Authentication required"))?;
        let Json(body) = Json::<T>::from_request(req, state)
            .await
            .map_err(|rejection| rejection.into_response())?;

        let connection_id = body
            .connection_id()
            .ok_or_else(|| bad_request("connection_id is required"))?;
        let connection_id =
            Uuid::parse_str(connection_id).map_err(|_| bad_request("Invalid connection_id"))?;

        let connection = state
            .authorization_service
            .require_provider_connection_owned(
                &connection_id,
                &auth_context.user_id,
                state.db_repository.as_ref(),
            )
            .await
            .map_err(|status| match status {
                StatusCode::NOT_FOUND => not_found("Connection not found"),
                _ => error_response(status, "INTERNAL_SERVER_ERROR", "Authorization failed"),
            })?;

        Ok(Self { _body: body, connection })
    }
}
