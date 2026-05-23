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

#[test]
fn given_provider_info_when_generating_openapi_then_documents_simplefin_in_example() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    let providers = spec["components"]["schemas"]["ProviderInfoResponse"]["example"]
        ["available_providers"]
        .as_array()
        .expect("available_providers array");

    assert!(
        providers.iter().any(|provider| provider == "simplefin"),
        "expected simplefin in ProviderInfoResponse example"
    );
}

#[test]
fn given_provider_connect_when_generating_openapi_then_documents_simplefin_setup_token_field() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    let request_schema = &spec["components"]["schemas"]["ProviderConnectRequest"];

    let simplefin_setup_token = &request_schema["properties"]["simplefin_setup_token"];
    assert_eq!(
        simplefin_setup_token["type"],
        serde_json::json!(["string", "null"])
    );
}

#[test]
fn given_transactions_insights_when_generating_openapi_then_documents_endpoint_and_schemas() {
    let spec = serde_json::to_value(init_openapi()).unwrap();
    let path = &spec["paths"]["/api/transactions/insights"]["get"];

    assert_eq!(path["tags"], serde_json::json!(["Transactions"]));
    assert_eq!(
        path["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
        serde_json::json!("#/components/schemas/TransactionsInsightsResponse")
    );
    assert_eq!(
        spec["components"]["schemas"]["LargestTransaction"]["type"],
        serde_json::json!("object")
    );
    assert_eq!(
        spec["components"]["schemas"]["LargestTransaction"]["properties"]["merchant"]["type"],
        serde_json::json!("string")
    );
}
