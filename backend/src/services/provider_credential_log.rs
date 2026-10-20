pub const STATUS_OK: &str = "200 OK";
pub const STATUS_BAD_REQUEST: &str = "400 Bad Request";
pub const STATUS_FAILED_DEPENDENCY: &str = "424 Failed Dependency";

pub fn log_provider_credential_outcome(provider: &str, status: &str, endpoint: &str) {
    tracing::info!(
        target: "provider_credentials",
        provider,
        status = %status,
        endpoint,
        "Provider credential endpoint completed"
    );
}
