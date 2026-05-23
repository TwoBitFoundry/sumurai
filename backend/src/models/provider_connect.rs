use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::models::simplefin::SimpleFinConnectRequest;

use serde_json::json;

pub fn provider_connect_request_example() -> serde_json::Value {
    json!({
        "provider": "teller",
        "access_token": "access-sandbox-xyz",
        "enrollment_id": "enroll-123",
        "institution_name": "Teller Demo Bank",
        "simplefin": {
            "simplefin_setup_token": null
        }
    })
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[schema(example = json!({
    "provider": "teller",
    "access_token": "access-sandbox-xyz",
    "enrollment_id": "enroll-123",
    "institution_name": "Teller Demo Bank",
    "simplefin": {
        "simplefin_setup_token": null
    }
}))]
pub struct ProviderConnectRequest {
    pub provider: String,
    pub access_token: String,
    pub enrollment_id: String,
    pub institution_name: Option<String>,
    #[serde(default)]
    pub simplefin: SimpleFinConnectRequest,
}
