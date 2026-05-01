use std::time::Duration;

pub struct AuthEndpointRateLimitPolicy;

impl AuthEndpointRateLimitPolicy {
    pub const REQUESTS_PER_WINDOW: u32 = 5;
    pub const WINDOW_SECS: u64 = 60;
    pub const BURST: u32 = 5;

    pub fn token_refill_period() -> Duration {
        Duration::from_secs(Self::WINDOW_SECS / Self::REQUESTS_PER_WINDOW as u64)
    }
}
