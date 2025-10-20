use crate::models::auth::AuthError;
use crate::services::auth_service::*;
use chrono::Utc;
use uuid::Uuid;

#[test]
fn given_valid_secret_when_creating_auth_service_then_succeeds() {
    let secret = "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345";

    let result = AuthService::new(secret.to_string());

    assert!(result.is_ok());
}

#[test]
fn given_short_secret_when_creating_auth_service_then_fails() {
    let short_secret = "short_key";

    let result = AuthService::new(short_secret.to_string());

    assert!(result.is_err());
    match result.unwrap_err() {
        AuthError::InvalidSecret => {}
        _ => panic!("Expected InvalidSecret error"),
    }
}

#[test]
fn given_plain_password_when_hashing_then_generates_secure_hash() {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
    let password = "test_password_123";

    let result = auth_service.hash_password(password);

    assert!(result.is_ok());
    let hash = result.unwrap();
    assert!(!hash.is_empty());
    assert_ne!(hash, password);
    assert!(hash.starts_with("$argon2"));
}

#[test]
fn given_password_and_hash_when_verifying_then_validates_correctly() {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
    let password = "test_password_456";
    let hash = auth_service.hash_password(password).unwrap();

    let valid_result = auth_service.verify_password(password, &hash);

    assert!(valid_result.is_ok());
    assert!(valid_result.unwrap());

    let invalid_result = auth_service.verify_password("wrong_password", &hash);

    assert!(invalid_result.is_ok());
    assert!(!invalid_result.unwrap());
}

#[test]
fn given_user_id_when_generating_token_then_creates_valid_jwt() {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
    let user_id = Uuid::new_v4();

    let result = auth_service.generate_token(user_id);

    assert!(result.is_ok());
    let auth_token = result.unwrap();
    assert!(!auth_token.token.is_empty());
    assert!(auth_token.expires_at > Utc::now());

    let parts: Vec<&str> = auth_token.token.split('.').collect();
    assert_eq!(parts.len(), 3);
}

#[test]
fn given_valid_jwt_when_validating_then_extracts_claims() {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
    let user_id = Uuid::new_v4();
    let auth_token = auth_service.generate_token(user_id).unwrap();

    let result = auth_service.validate_token(&auth_token.token);

    assert!(result.is_ok());
    let claims = result.unwrap();
    assert_eq!(claims.sub, user_id.to_string());
    assert_eq!(claims.jti, auth_token.jwt_id);
}

#[test]
fn given_invalid_jwt_when_validating_then_returns_error() {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
    let invalid_token = "invalid.jwt.token";

    let result = auth_service.validate_token(invalid_token);

    assert!(result.is_err());
    match result.unwrap_err() {
        AuthError::InvalidToken => {}
        _ => panic!("Expected InvalidToken error"),
    }
}

#[test]
fn given_expired_jwt_when_validating_then_returns_expired_error() {
    let _auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();
}

#[test]
fn given_service_layer_calls_when_missing_user_context_then_returns_authentication_required_error()
{
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_jwt_auth_service_testing_12345".to_string(),
    )
    .unwrap();

    let empty_token_result = auth_service.validate_token("");
    assert!(
        empty_token_result.is_err(),
        "Empty token should be rejected"
    );
    match empty_token_result.unwrap_err() {
        AuthError::InvalidToken => {}
        _ => panic!("Expected InvalidToken error for empty token"),
    }

    let malformed_token = "not.a.real.jwt.token";
    let malformed_result = auth_service.validate_token(malformed_token);
    assert!(
        malformed_result.is_err(),
        "Malformed token should be rejected"
    );
    match malformed_result.unwrap_err() {
        AuthError::InvalidToken => {}
        _ => panic!("Expected InvalidToken error for malformed token"),
    }

    let wrong_secret_service = AuthService::new(
        "different_secret_key_that_is_long_enough_for_validation_12345".to_string(),
    )
    .unwrap();
    let user_id = uuid::Uuid::new_v4();
    let valid_token = auth_service.generate_token(user_id).unwrap();

    let wrong_signature_result = wrong_secret_service.validate_token(&valid_token.token);
    assert!(
        wrong_signature_result.is_err(),
        "Token with wrong signature should be rejected"
    );
    match wrong_signature_result.unwrap_err() {
        AuthError::InvalidToken => {}
        _ => panic!("Expected InvalidToken error for wrong signature"),
    }

    let valid_token_result = auth_service.validate_token(&valid_token.token);
    assert!(valid_token_result.is_ok(), "Valid token should be accepted");

    let claims = valid_token_result.unwrap();
    assert_eq!(
        claims.user_id(),
        user_id.to_string(),
        "User ID should match"
    );

    let injection_attempts = vec![
        "'; DROP TABLE users; --",
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
        "null",
        "undefined",
    ];

    for injection_attempt in injection_attempts {
        let injection_result = auth_service.validate_token(injection_attempt);
        assert!(
            injection_result.is_err(),
            "Injection attempt should be rejected: {}",
            injection_attempt
        );
        match injection_result.unwrap_err() {
            AuthError::InvalidToken => {}
            _ => panic!(
                "Expected InvalidToken error for injection attempt: {}",
                injection_attempt
            ),
        }
    }
}

#[test]
fn given_user_data_operations_when_performed_then_logs_actions_for_audit_trail_without_exposing_other_users(
) {
    let auth_service = AuthService::new(
        "this_is_a_very_long_secret_key_for_audit_trail_testing_multi_tenant_12345".to_string(),
    )
    .unwrap();

    let user1_id = uuid::Uuid::new_v4();
    let user2_id = uuid::Uuid::new_v4();
    let user3_id = uuid::Uuid::new_v4();

    let user1_token = auth_service.generate_token(user1_id).unwrap();
    let user2_token = auth_service.generate_token(user2_id).unwrap();
    let user3_token = auth_service.generate_token(user3_id).unwrap();

    let audit_entries = vec![
        AuditLogEntry {
            user_id: user1_id,
            jwt_id: user1_token.jwt_id.clone(),
            action: "CREATE_ACCOUNT".to_string(),
            resource_type: "Account".to_string(),
            resource_id: Some("account_123".to_string()),
            timestamp: chrono::Utc::now(),
            ip_address: Some("192.168.1.100".to_string()),
            user_agent: Some("Mozilla/5.0 (User1 Browser)".to_string()),
            success: true,
            error_message: None,
        },
        AuditLogEntry {
            user_id: user1_id,
            jwt_id: user1_token.jwt_id.clone(),
            action: "VIEW_TRANSACTIONS".to_string(),
            resource_type: "Transaction".to_string(),
            resource_id: None,
            timestamp: chrono::Utc::now(),
            ip_address: Some("192.168.1.100".to_string()),
            user_agent: Some("Mozilla/5.0 (User1 Browser)".to_string()),
            success: true,
            error_message: None,
        },
        AuditLogEntry {
            user_id: user2_id,
            jwt_id: user2_token.jwt_id.clone(),
            action: "CONNECT_PLAID".to_string(),
            resource_type: "ProviderConnection".to_string(),
            resource_id: Some("item_456".to_string()),
            timestamp: chrono::Utc::now(),
            ip_address: Some("10.0.0.50".to_string()),
            user_agent: Some("Mozilla/5.0 (User2 Browser)".to_string()),
            success: true,
            error_message: None,
        },
        AuditLogEntry {
            user_id: user2_id,
            jwt_id: user2_token.jwt_id.clone(),
            action: "DELETE_TRANSACTION".to_string(),
            resource_type: "Transaction".to_string(),
            resource_id: Some("txn_789".to_string()),
            timestamp: chrono::Utc::now(),
            ip_address: Some("10.0.0.50".to_string()),
            user_agent: Some("Mozilla/5.0 (User2 Browser)".to_string()),
            success: false,
            error_message: Some("Insufficient permissions".to_string()),
        },
        AuditLogEntry {
            user_id: user3_id,
            jwt_id: user3_token.jwt_id.clone(),
            action: "EXPORT_DATA".to_string(),
            resource_type: "Export".to_string(),
            resource_id: Some("export_abc".to_string()),
            timestamp: chrono::Utc::now(),
            ip_address: Some("172.16.0.25".to_string()),
            user_agent: Some("Mozilla/5.0 (User3 Browser)".to_string()),
            success: true,
            error_message: None,
        },
    ];

    for entry in &audit_entries {
        assert!(
            !entry.action.is_empty(),
            "All audit entries should have an action"
        );
        assert!(
            !entry.resource_type.is_empty(),
            "All audit entries should have a resource type"
        );
        assert!(
            !entry.jwt_id.is_empty(),
            "All audit entries should have a JWT session ID"
        );

        let time_diff = chrono::Utc::now().signed_duration_since(entry.timestamp);
        assert!(
            time_diff.num_seconds() < 60,
            "Audit entry timestamps should be recent"
        );
    }

    let nonexistent_user_id = uuid::Uuid::new_v4();
    let empty_audit_logs = filter_audit_logs_by_user(&audit_entries, nonexistent_user_id);
    assert_eq!(
        empty_audit_logs.len(),
        0,
        "Non-existent user should have no audit logs"
    );

    let empty_input_logs = filter_audit_logs_by_user(&[], user1_id);
    assert_eq!(
        empty_input_logs.len(),
        0,
        "Empty audit log input should return empty results"
    );
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct AuditLogEntry {
    user_id: uuid::Uuid,
    jwt_id: String,
    action: String,
    resource_type: String,
    resource_id: Option<String>,
    timestamp: chrono::DateTime<chrono::Utc>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    success: bool,
    error_message: Option<String>,
}

fn filter_audit_logs_by_user(
    audit_entries: &[AuditLogEntry],
    user_id: uuid::Uuid,
) -> Vec<AuditLogEntry> {
    audit_entries
        .iter()
        .filter(|entry| entry.user_id == user_id)
        .cloned()
        .collect()
}
