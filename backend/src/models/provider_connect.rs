use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::models::simplefin::SimpleFinConnectRequest;

use serde_json::json;

pub fn provider_connect_request_example() -> serde_json::Value {
    json!({
        "provider": "simplefin",
        "access_token": "",
        "enrollment_id": "",
        "institution_name": null,
        "simplefin": {
            "simplefin_setup_token": "demo-setup-token"
        }
    })
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[schema(example = json!({
    "provider": "simplefin",
    "access_token": "",
    "enrollment_id": "",
    "institution_name": null,
    "simplefin": {
        "simplefin_setup_token": "demo-setup-token"
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
