use crate::models::{ip_ban::AuthIpBanPolicy, plaid::ProviderConnection};
use uuid::Uuid;

#[test]
fn given_new_plaid_connection_when_created_then_has_correct_defaults() {
    let user_id = Uuid::new_v4();
    let item_id = "test_item";

    let connection = ProviderConnection::new(user_id, item_id);

    assert_eq!(connection.user_id, user_id);
    assert_eq!(connection.item_id, "test_item");
    assert!(!connection.is_connected);
    assert!(connection.last_sync_at.is_none());
    assert!(connection.connected_at.is_none());
    assert!(connection.disconnected_at.is_none());
    assert!(connection.institution_name.is_none());
    assert_eq!(connection.transaction_count, 0);
    assert_eq!(connection.account_count, 0);
    assert!(connection.created_at.is_some());
    assert!(connection.updated_at.is_some());
}

#[test]
fn given_disconnected_connection_when_marking_connected_then_updates_status() {
    let user_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item");
    assert!(!connection.is_connected);
    assert!(connection.connected_at.is_none());

    connection.mark_connected("Chase Bank");

    assert!(connection.is_connected);
    assert!(connection.connected_at.is_some());
    assert!(connection.disconnected_at.is_none());
    assert_eq!(connection.institution_name, Some("Chase Bank".to_string()));
    assert!(connection.updated_at.is_some());
}

#[test]
fn given_connected_connection_when_updating_sync_info_then_records_metadata() {
    let user_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(user_id, "item");
    connection.mark_connected("Bank");
    assert!(connection.last_sync_at.is_none());

    connection.update_sync_info(15, 3);

    assert!(connection.last_sync_at.is_some());
    assert_eq!(connection.transaction_count, 15);
    assert_eq!(connection.account_count, 3);
    assert!(connection.updated_at.is_some());
}

#[test]
fn given_plaid_connection_when_serializing_then_preserves_all_fields() {
    let test_user_id = Uuid::new_v4();
    let mut connection = ProviderConnection::new(test_user_id, "test_item");
    connection.mark_connected("Test Bank");
    connection.update_sync_info(5, 1);

    let json_result = serde_json::to_string(&connection);

    assert!(json_result.is_ok());
    let json_str = json_result.unwrap();
    assert!(json_str.contains(&test_user_id.to_string()));
    assert!(json_str.contains("test_item"));
    assert!(json_str.contains("Test Bank"));
    assert!(json_str.contains("\"transaction_count\":5"));
    assert!(json_str.contains("\"account_count\":1"));
}

#[test]
fn given_strike_counts_when_lockout_duration_then_matches_progressive_tiers() {
    assert_eq!(
        AuthIpBanPolicy::lockout_secs_for_strike_count(1),
        AuthIpBanPolicy::LOCKOUT_STRIKE_1_SECS
    );
    assert_eq!(
        AuthIpBanPolicy::lockout_secs_for_strike_count(2),
        AuthIpBanPolicy::LOCKOUT_STRIKE_2_SECS
    );
    assert_eq!(
        AuthIpBanPolicy::lockout_secs_for_strike_count(3),
        AuthIpBanPolicy::LOCKOUT_STRIKE_3_SECS
    );
    assert_eq!(
        AuthIpBanPolicy::lockout_secs_for_strike_count(99),
        AuthIpBanPolicy::LOCKOUT_STRIKE_3_SECS
    );
}
