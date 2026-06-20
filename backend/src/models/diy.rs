use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({"name": "My Cash"}))]
pub struct CreateDiyInstitutionRequest {
    pub name: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({"connection_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"}))]
pub struct CreateDiyInstitutionResponse {
    pub connection_id: Uuid,
}

#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({
    "name": "My Checking",
    "account_type": "depository",
    "mask": "1234",
    "balance": "1000.00"
}))]
pub struct CreateDiyAccountRequest {
    pub name: String,
    pub account_type: String,
    pub mask: Option<String>,
    #[schema(value_type = Option<String>)]
    pub balance: Option<Decimal>,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(example = json!({
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "name": "My Checking",
    "account_type": "depository"
}))]
pub struct CreateDiyAccountResponse {
    pub id: Uuid,
    pub name: String,
    pub account_type: String,
}
