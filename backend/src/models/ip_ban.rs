pub struct AuthIpBanPolicy;

impl AuthIpBanPolicy {
    pub const LOCKOUT_STRIKE_1_SECS: u64 = 300;
    pub const LOCKOUT_STRIKE_2_SECS: u64 = 3600;
    pub const LOCKOUT_STRIKE_3_SECS: u64 = 86400;
    pub const STRIKE_TRACKING_WINDOW_SECS: u64 = 604800;

    pub fn ban_key(ip: &str) -> String {
        format!("auth_ban:ip:{ip}")
    }

    pub fn strike_key(ip: &str) -> String {
        format!("auth_rl_strikes:ip:{ip}")
    }

    pub fn lockout_secs_for_strike_count(count: i64) -> u64 {
        let tier = count.clamp(1, 3);
        match tier {
            1 => Self::LOCKOUT_STRIKE_1_SECS,
            2 => Self::LOCKOUT_STRIKE_2_SECS,
            _ => Self::LOCKOUT_STRIKE_3_SECS,
        }
    }
}
