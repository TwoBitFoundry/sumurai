use crate::openapi::init_openapi;

#[test]
fn given_cookie_auth_when_generating_openapi_then_documents_auth_cookie_scheme() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    let security_schemes = &spec["components"]["securitySchemes"];

    assert!(security_schemes.get("bearer_auth").is_none());
    assert_eq!(security_schemes["auth_cookie"]["type"], "apiKey");
    assert_eq!(security_schemes["auth_cookie"]["in"], "cookie");
    assert_eq!(security_schemes["auth_cookie"]["name"], "auth_token");
    assert_eq!(spec["security"][0]["auth_cookie"], serde_json::json!([]));
}
