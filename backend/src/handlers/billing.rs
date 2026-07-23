use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::{AuthContext, User};
use crate::models::billing::{
    BillingCheckoutResponse, BillingPortalSessionResponse, BillingStatusResponse,
    TrialStartRequest, TrialStartResponse,
};
use crate::services::billing_service::{
    BillingService, BillingServiceError, BillingWebhookError, TrialStartInput,
};

pub fn billing_webhook_routes() -> Router<AppState> {
    Router::new().route(
        "/api/billing/webhooks/paddle",
        post(handle_paddle_billing_webhook),
    )
}

pub fn billing_authenticated_routes() -> Router<AppState> {
    Router::new()
        .route("/api/billing/status", get(get_authenticated_billing_status))
        .route("/api/billing/checkout", post(create_billing_checkout))
        .route("/api/billing/trials/start", post(start_open_trial))
        .route(
            "/api/billing/payment-method",
            post(create_billing_payment_method),
        )
        .route(
            "/api/billing/portal-session",
            post(create_billing_portal_session),
        )
}

fn api_bad_request(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::new("BAD_REQUEST", &message.into()).into_response(StatusCode::BAD_REQUEST)
}

fn api_internal_server_error(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::new("INTERNAL_SERVER_ERROR", &message.into())
        .into_response(StatusCode::INTERNAL_SERVER_ERROR)
}

fn billing_disabled_response() -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::with_code(
        "BILLING_DISABLED",
        "Billing is not enabled for this deployment",
        "BILLING_DISABLED",
    )
    .into_response(StatusCode::NOT_FOUND)
}

fn trials_disabled_response() -> (StatusCode, Json<ApiErrorResponse>) {
    ApiErrorResponse::with_code(
        "TRIALS_DISABLED",
        "Trial starts are not enabled for this deployment",
        "TRIALS_DISABLED",
    )
    .into_response(StatusCode::NOT_FOUND)
}

async fn load_billing_user(
    state: &AppState,
    user_id: &Uuid,
) -> Result<User, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .db_repository
        .get_user_by_id(user_id)
        .await
        .map_err(|error| {
            tracing::error!("Failed to load user for billing endpoint: {}", error);
            api_internal_server_error("Failed to load billing user")
        })?
        .ok_or_else(|| api_internal_server_error("Failed to load billing user"))
}

fn billing_service_error_response(
    error: BillingServiceError,
) -> (StatusCode, Json<ApiErrorResponse>) {
    match error {
        BillingServiceError::BillingDisabled => billing_disabled_response(),
        BillingServiceError::TrialsDisabled => trials_disabled_response(),
        BillingServiceError::InvalidTrialStart => {
            api_bad_request("Country and postal code are required")
        }
        BillingServiceError::TrialAlreadyUsed => ApiErrorResponse::with_code(
            "TRIAL_ALREADY_USED",
            "A trial or paid entitlement has already been used for this account",
            "TRIAL_ALREADY_USED",
        )
        .into_response(StatusCode::CONFLICT),
        BillingServiceError::EntitlementUnavailable => ApiErrorResponse::with_code(
            "BILLING_ENTITLEMENT_UNAVAILABLE",
            "Billing entitlement is unavailable",
            "BILLING_ENTITLEMENT_UNAVAILABLE",
        )
        .into_response(StatusCode::CONFLICT),
        BillingServiceError::PaddleRequestFailed => ApiErrorResponse::with_code(
            "PADDLE_REQUEST_FAILED",
            "Paddle request failed",
            "PADDLE_REQUEST_FAILED",
        )
        .into_response(StatusCode::BAD_GATEWAY),
        BillingServiceError::RepositoryRequestFailed => {
            api_internal_server_error("Billing request failed")
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/billing/status",
    responses(
        (status = 200, description = "Billing status", body = BillingStatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn get_authenticated_billing_status(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BillingStatusResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let user = state
        .db_repository
        .get_user_by_id(&auth_context.user_id)
        .await
        .map_err(|error| {
            tracing::error!("Failed to load user for billing status: {}", error);
            api_internal_server_error("Failed to load billing status")
        })?
        .ok_or_else(|| api_internal_server_error("Failed to load billing status"))?;

    if !state.config.is_billing_enabled() {
        return Ok(Json(BillingStatusResponse {
            billing_enabled: false,
            trials_enabled: false,
            paddle_client_token: None,
            paddle_environment: None,
            access_status: "unrestricted".to_string(),
            can_use_own_data: true,
            is_demo_mode_active: user.demo_mode_active,
            trial_ends_at: None,
            current_period_ends_at: None,
            scheduled_cancel_at: None,
            payment_method_required: false,
            billing_portal_available: false,
            enabled_financial_providers: state
                .config
                .enabled_financial_providers()
                .unwrap_or(&[])
                .to_vec(),
        }));
    }

    let entitlement = state
        .db_repository
        .get_billing_entitlement(&auth_context.user_id)
        .await
        .map_err(|error| {
            tracing::error!("Failed to load billing entitlement: {}", error);
            api_internal_server_error("Failed to load billing status")
        })?;

    let billing_service = &state.billing_service;
    let access_status = BillingService::project_local_access_status(
        entitlement.as_ref().map(|row| row.access_status.as_str()),
    );
    let decision = billing_service.decision_for_status(access_status);
    let billing_portal_available = entitlement
        .as_ref()
        .and_then(|row| row.paddle_customer_id.as_ref())
        .is_some();
    let paddle_config = state
        .config
        .paddle_billing()
        .ok_or_else(|| api_internal_server_error("Failed to load billing status"))?;

    Ok(Json(BillingStatusResponse {
        billing_enabled: true,
        trials_enabled: state.config.is_trials_enabled(),
        paddle_client_token: Some(paddle_config.client_token.clone()),
        paddle_environment: Some(paddle_config.environment.clone()),
        access_status: access_status.as_str().to_string(),
        can_use_own_data: decision.can_use_own_data,
        is_demo_mode_active: user.demo_mode_active,
        trial_ends_at: entitlement.as_ref().and_then(|row| row.trial_ends_at),
        current_period_ends_at: entitlement
            .as_ref()
            .and_then(|row| row.current_period_ends_at),
        scheduled_cancel_at: entitlement.as_ref().and_then(|row| row.scheduled_cancel_at),
        payment_method_required: decision.payment_method_required,
        billing_portal_available,
        enabled_financial_providers: state
            .config
            .enabled_financial_providers()
            .unwrap_or(&[])
            .to_vec(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/billing/checkout",
    responses(
        (status = 200, description = "Paddle checkout created", body = BillingCheckoutResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Billing disabled", body = ApiErrorResponse),
        (status = 502, description = "Paddle request failed", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn create_billing_checkout(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BillingCheckoutResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_billing_enabled() {
        return Err(billing_disabled_response());
    }
    let user = load_billing_user(&state, &auth_context.user_id).await?;
    let checkout = state
        .billing_service
        .create_checkout_for_user(&user)
        .await
        .map_err(billing_service_error_response)?;
    Ok(Json(BillingCheckoutResponse {
        checkout_url: checkout.checkout_url,
        transaction_id: checkout.transaction_id,
    }))
}

#[utoipa::path(
    post,
    path = "/api/billing/trials/start",
    request_body = TrialStartRequest,
    responses(
        (status = 200, description = "Open trial start pending webhook fulfillment", body = TrialStartResponse),
        (status = 400, description = "Invalid trial start", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Billing or trials disabled", body = ApiErrorResponse),
        (status = 409, description = "Trial already used", body = ApiErrorResponse),
        (status = 429, description = "Rate limited", body = ApiErrorResponse),
        (status = 502, description = "Paddle request failed", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn start_open_trial(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<TrialStartRequest>,
) -> Result<Json<TrialStartResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_billing_enabled() {
        return Err(billing_disabled_response());
    }
    if !state.config.is_trials_enabled() {
        return Err(trials_disabled_response());
    }
    if req.country_code.trim().is_empty() || req.postal_code.trim().is_empty() {
        return Err(api_bad_request("Country and postal code are required"));
    }
    let attempts = state
        .cache_service
        .increment_counter(
            &format!("billing_trial_start:{}", auth_context.user_id),
            3600,
        )
        .await
        .map_err(|error| {
            tracing::error!("Failed to rate limit trial start: {}", error);
            api_internal_server_error("Failed to start trial")
        })?;
    if attempts > 10 {
        return Err(ApiErrorResponse::with_code(
            "RATE_LIMITED",
            "Too many trial start attempts",
            "RATE_LIMITED",
        )
        .into_response(StatusCode::TOO_MANY_REQUESTS));
    }

    let user = load_billing_user(&state, &auth_context.user_id).await?;
    state
        .billing_service
        .start_open_trial(
            &user,
            TrialStartInput {
                country_code: &req.country_code,
                postal_code: &req.postal_code,
            },
        )
        .await
        .map_err(billing_service_error_response)?;
    Ok(Json(TrialStartResponse {
        status: "pending".to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/billing/payment-method",
    responses(
        (status = 200, description = "Payment method checkout transaction created", body = BillingCheckoutResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Billing disabled", body = ApiErrorResponse),
        (status = 409, description = "Entitlement unavailable", body = ApiErrorResponse),
        (status = 502, description = "Paddle request failed", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn create_billing_payment_method(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BillingCheckoutResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_billing_enabled() {
        return Err(billing_disabled_response());
    }
    let user = load_billing_user(&state, &auth_context.user_id).await?;
    let checkout = state
        .billing_service
        .create_payment_method_transaction(&user)
        .await
        .map_err(billing_service_error_response)?;
    Ok(Json(BillingCheckoutResponse {
        checkout_url: checkout.checkout_url,
        transaction_id: checkout.transaction_id,
    }))
}

#[utoipa::path(
    post,
    path = "/api/billing/portal-session",
    responses(
        (status = 200, description = "Billing portal session created", body = BillingPortalSessionResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Billing disabled", body = ApiErrorResponse),
        (status = 409, description = "Entitlement unavailable", body = ApiErrorResponse),
        (status = 502, description = "Paddle request failed", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn create_billing_portal_session(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<BillingPortalSessionResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_billing_enabled() {
        return Err(billing_disabled_response());
    }
    let user = load_billing_user(&state, &auth_context.user_id).await?;
    let portal = state
        .billing_service
        .create_portal_session(&user)
        .await
        .map_err(billing_service_error_response)?;
    Ok(Json(BillingPortalSessionResponse {
        overview_url: portal.overview_url,
        subscription_urls: portal.subscription_urls,
    }))
}

#[utoipa::path(
    post,
    path = "/api/billing/webhooks/paddle",
    request_body(content = String, content_type = "application/json"),
    responses(
        (status = 200, description = "Webhook accepted"),
        (status = 400, description = "Invalid webhook", body = ApiErrorResponse),
        (status = 404, description = "Billing disabled", body = ApiErrorResponse),
        (status = 500, description = "Internal server error", body = ApiErrorResponse)
    ),
    tag = "Billing"
)]
pub async fn handle_paddle_billing_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    raw_body: Bytes,
) -> Result<StatusCode, (StatusCode, Json<ApiErrorResponse>)> {
    state
        .billing_service
        .process_paddle_webhook(
            headers
                .get("Paddle-Signature")
                .and_then(|value| value.to_str().ok()),
            &raw_body,
            Utc::now().timestamp(),
        )
        .await
        .map_err(|error| match error {
            BillingWebhookError::BillingDisabled => billing_disabled_response(),
            BillingWebhookError::InvalidSignature => api_bad_request("Invalid Paddle signature"),
            BillingWebhookError::InvalidPayload => api_bad_request("Invalid Paddle event"),
            BillingWebhookError::UnparseableSubscription => {
                api_bad_request("Unparseable Paddle subscription event")
            }
            BillingWebhookError::RepositoryRequestFailed => {
                api_internal_server_error("Failed to process Paddle webhook")
            }
        })?;

    Ok(StatusCode::OK)
}
