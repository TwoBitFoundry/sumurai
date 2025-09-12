use crate::models::plaid::PlaidConnection;
use uuid::Uuid;

#[test]
fn given_new_plaid_connection_when_created_then_has_correct_defaults() {
    let user_id = Uuid::new_v4();
    let item_id = "test_item";

    let connection = PlaidConnection::new(user_id, item_id);

    assert_eq!(connection.user_id, user_id);
    assert_eq!(connection.item_id, "test_item");
    assert_eq!(connection.is_connected, false);
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
    let mut connection = PlaidConnection::new(user_id, "item");
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
fn given_connected_connection_when_marking_disconnected_then_clears_state() {
    let user_id = Uuid::new_v4();
    let mut connection = PlaidConnection::new(user_id, "item");
    connection.mark_connected("Bank");
    connection.update_sync_info(10, 2);
    assert!(connection.is_connected);
    assert_eq!(connection.transaction_count, 10);

    connection.mark_disconnected();

    assert!(!connection.is_connected);
    assert!(connection.disconnected_at.is_some());
    assert!(connection.last_sync_at.is_none());
    assert_eq!(connection.transaction_count, 0);
    assert_eq!(connection.account_count, 0);
    assert!(connection.updated_at.is_some());
}

#[test]
fn given_connected_connection_when_updating_sync_info_then_records_metadata() {
    let user_id = Uuid::new_v4();
    let mut connection = PlaidConnection::new(user_id, "item");
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
    let mut connection = PlaidConnection::new(test_user_id, "test_item");
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
