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
    TrialRedeemRequest, TrialRedeemResponse,
};
use crate::services::billing_service::{
    BillingService, BillingServiceError, BillingWebhookError, TrialRedemptionInput,
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
        .route("/api/billing/trials/redeem", post(redeem_trial_code))
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
        BillingServiceError::InvalidTrialRedemption => api_bad_request("Invalid trial redemption"),
        BillingServiceError::TrialCodeUnavailable => ApiErrorResponse::with_code(
            "TRIAL_CODE_UNAVAILABLE",
            "Trial code is unavailable",
            "TRIAL_CODE_UNAVAILABLE",
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
    if !state.config.is_billing_enabled() {
        return Ok(Json(BillingStatusResponse {
            billing_enabled: false,
            access_status: "unrestricted".to_string(),
            can_use_own_data: true,
            is_demo_mode_active: false,
            trial_ends_at: None,
            current_period_ends_at: None,
            payment_method_required: false,
            billing_portal_available: false,
            enabled_financial_providers: state
                .config
                .enabled_financial_providers()
                .unwrap_or(&[])
                .to_vec(),
        }));
    }

    let user = state
        .db_repository
        .get_user_by_id(&auth_context.user_id)
        .await
        .map_err(|error| {
            tracing::error!("Failed to load user for billing status: {}", error);
            api_internal_server_error("Failed to load billing status")
        })?
        .ok_or_else(|| api_internal_server_error("Failed to load billing status"))?;

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

    Ok(Json(BillingStatusResponse {
        billing_enabled: true,
        access_status: access_status.as_str().to_string(),
        can_use_own_data: decision.can_use_own_data,
        is_demo_mode_active: user.demo_mode_active,
        trial_ends_at: entitlement.as_ref().and_then(|row| row.trial_ends_at),
        current_period_ends_at: entitlement
            .as_ref()
            .and_then(|row| row.current_period_ends_at),
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
    path = "/api/billing/trials/redeem",
    request_body = TrialRedeemRequest,
    responses(
        (status = 200, description = "Trial redemption pending webhook fulfillment", body = TrialRedeemResponse),
        (status = 400, description = "Invalid trial redemption", body = ApiErrorResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Billing disabled", body = ApiErrorResponse),
        (status = 409, description = "Trial code unavailable", body = ApiErrorResponse),
        (status = 429, description = "Rate limited", body = ApiErrorResponse),
        (status = 502, description = "Paddle request failed", body = ApiErrorResponse)
    ),
    security(("auth_cookie" = [])),
    tag = "Billing"
)]
pub async fn redeem_trial_code(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<TrialRedeemRequest>,
) -> Result<Json<TrialRedeemResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    if !state.config.is_billing_enabled() {
        return Err(billing_disabled_response());
    }
    if req.code.trim().is_empty()
        || req.country_code.trim().is_empty()
        || req.postal_code.trim().is_empty()
    {
        return Err(api_bad_request(
            "Trial code, country, and postal code are required",
        ));
    }
    let attempts = state
        .cache_service
        .increment_counter(
            &format!("billing_trial_redeem:{}", auth_context.user_id),
            3600,
        )
        .await
        .map_err(|error| {
            tracing::error!("Failed to rate limit trial redemption: {}", error);
            api_internal_server_error("Failed to redeem trial code")
        })?;
    if attempts > 10 {
        return Err(ApiErrorResponse::with_code(
            "RATE_LIMITED",
            "Too many trial redemption attempts",
            "RATE_LIMITED",
        )
        .into_response(StatusCode::TOO_MANY_REQUESTS));
    }

    let user = load_billing_user(&state, &auth_context.user_id).await?;
    state
        .billing_service
        .redeem_trial_code(
            &user,
            TrialRedemptionInput {
                code: &req.code,
                country_code: &req.country_code,
                postal_code: &req.postal_code,
            },
        )
        .await
        .map_err(billing_service_error_response)?;
    Ok(Json(TrialRedeemResponse {
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
        (status = 200, description = "Temporary Paddle portal session links", body = BillingPortalSessionResponse),
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
            BillingWebhookError::RepositoryRequestFailed => {
                api_internal_server_error("Failed to process Paddle webhook")
            }
        })?;

    Ok(StatusCode::OK)
}
