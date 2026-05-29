use crate::services::webauthn_service::WebAuthnService;
use url::Url;
use webauthn_rs::prelude::PasskeyAuthentication;

fn test_service() -> WebAuthnService {
    let origins = [Url::parse("http://localhost:8080").unwrap()];
    WebAuthnService::new("localhost", &origins).expect("WebAuthnService should build")
}

#[test]
fn given_valid_config_when_new_then_builds() {
    let _service = test_service();
}

#[test]
fn given_invalid_origin_when_new_then_errors() {
    let origins = [Url::parse("http://localhost:8080").unwrap()];
    let result = WebAuthnService::new("", &origins);
    assert!(result.is_err(), "empty rp_id should fail");
}

#[test]
fn given_local_dev_origins_when_new_then_builds() {
    let origins = [
        Url::parse("http://localhost:8080").unwrap(),
        Url::parse("http://localhost:3001").unwrap(),
    ];
    let service = WebAuthnService::new("localhost", &origins);
    assert!(service.is_ok());
}

#[test]
fn given_user_when_begin_registration_then_returns_challenge_and_state() {
    let service = test_service();
    let user_id = uuid::Uuid::new_v4();
    let result = service.begin_registration(user_id, "user@example.com", "User", &[]);
    assert!(
        result.is_ok(),
        "begin_registration should succeed: {:?}",
        result
    );
    let (challenge, state) = result.unwrap();
    let challenge_json = serde_json::to_value(&challenge).unwrap();
    assert!(challenge_json.get("publicKey").is_some());
    let state_json = serde_json::to_string(&state).unwrap();
    assert!(!state_json.is_empty());
}

#[test]
fn given_registration_state_when_serialized_then_round_trips() {
    let service = test_service();
    let user_id = uuid::Uuid::new_v4();
    let (_, state) = service
        .begin_registration(user_id, "user@example.com", "User", &[])
        .unwrap();

    let json = serde_json::to_string(&state).unwrap();
    let restored: webauthn_rs::prelude::PasskeyRegistration = serde_json::from_str(&json).unwrap();
    let json2 = serde_json::to_string(&restored).unwrap();
    assert_eq!(json, json2);
}

#[test]
fn given_wrong_response_when_finish_registration_then_errors() {
    use webauthn_rs::prelude::RegisterPublicKeyCredential;
    let service = test_service();
    let user_id = uuid::Uuid::new_v4();
    let (_, state) = service
        .begin_registration(user_id, "user@example.com", "User", &[])
        .unwrap();

    let bad_response: Result<RegisterPublicKeyCredential, _> = serde_json::from_str(
        r#"{"id":"bad","rawId":"bad","response":{"attestationObject":"bad","clientDataJSON":"bad"},"type":"public-key"}"#,
    );
    if let Ok(response) = bad_response {
        let result = service.finish_registration(&state, &response);
        assert!(
            result.is_err(),
            "finish_registration with bad response must fail"
        );
    }
}

#[test]
fn given_passkeys_when_begin_authentication_then_returns_challenge_and_state() {
    let service = test_service();
    let result = service.begin_authentication(&[]);
    assert!(
        result.is_ok(),
        "begin_authentication with empty passkeys should succeed: {:?}",
        result
    );
    let (challenge, _state) = result.unwrap();
    let challenge_json = serde_json::to_value(&challenge).unwrap();
    assert!(challenge_json.get("publicKey").is_some());
}

#[test]
fn given_authentication_state_when_serialized_then_round_trips() {
    let service = test_service();
    let (_, state) = service.begin_authentication(&[]).unwrap();

    let json = serde_json::to_string(&state).unwrap();
    let restored: PasskeyAuthentication = serde_json::from_str(&json).unwrap();
    let json2 = serde_json::to_string(&restored).unwrap();
    assert_eq!(json, json2);
}

#[test]
fn given_wrong_response_when_finish_authentication_then_errors() {
    use webauthn_rs::prelude::PublicKeyCredential;
    let service = test_service();
    let (_, state) = service.begin_authentication(&[]).unwrap();

    let bad_response: Result<PublicKeyCredential, _> = serde_json::from_str(
        r#"{"id":"bad","rawId":"bad","response":{"authenticatorData":"bad","clientDataJSON":"bad","signature":"bad"},"type":"public-key"}"#,
    );
    if let Ok(response) = bad_response {
        let result = service.finish_authentication(&state, &response);
        assert!(
            result.is_err(),
            "finish_authentication with bad response must fail"
        );
    }
}
