use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::Json,
};
use uuid::Uuid;

use crate::models::api_error::ApiErrorResponse;
use crate::models::app_state::AppState;
use crate::models::auth::AuthContext;
use crate::models::domain_error::DomainError;
use crate::models::import::{
    CsvColumnMapping, ImportMultipartRequest, ImportResponse, ImportUpload, ValidateResponse,
};

struct ParsedImportMultipart {
    file_name: String,
    file_bytes: Vec<u8>,
    account_id: Uuid,
    csv_mapping: Option<CsvColumnMapping>,
}

#[utoipa::path(
    post,
    path = "/api/transactions/import/validate",
    request_body(content = inline(ImportMultipartRequest), content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "File validation result", body = ValidateResponse),
        (status = 400, description = "Missing fields, invalid multipart payload, unsupported extension, invalid UTF-8, or invalid CSV mapping"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 403, description = "Account belongs to another user"),
        (status = 413, description = "Payload too large"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn validate_authenticated_transaction_import(
    State(state): State<AppState>,
    auth_context: AuthContext,
    mut multipart: Multipart,
) -> Result<Json<ValidateResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping,
    } = parse_transaction_import_multipart(&mut multipart).await?;

    state
        .imports()
        .validate(
            auth_context.user_id,
            ImportUpload {
                file_name,
                file_bytes,
                account_id,
                csv_mapping,
            },
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

#[utoipa::path(
    post,
    path = "/api/transactions/import",
    request_body(content = inline(ImportMultipartRequest), content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "Transactions imported successfully", body = ImportResponse),
        (status = 400, description = "Missing fields, invalid multipart payload, unsupported extension, invalid UTF-8, invalid CSV mapping, or file with no valid transactions"),
        (status = 401, description = "Unauthorized", body = ApiErrorResponse),
        (status = 403, description = "Account belongs to another user"),
        (status = 413, description = "Payload too large"),
        (status = 500, description = "Internal server error"),
    ),
    security(("auth_cookie" = [])),
    tag = "Transactions"
)]
pub async fn import_authenticated_transactions(
    State(state): State<AppState>,
    auth_context: AuthContext,
    mut multipart: Multipart,
) -> Result<Json<ImportResponse>, (StatusCode, Json<ApiErrorResponse>)> {
    let ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping,
    } = parse_transaction_import_multipart(&mut multipart).await?;

    state
        .imports()
        .import(
            auth_context.user_id,
            &auth_context.jwt_id,
            ImportUpload {
                file_name,
                file_bytes,
                account_id,
                csv_mapping,
            },
        )
        .await
        .map(Json)
        .map_err(Into::into)
}

async fn parse_transaction_import_multipart(
    multipart: &mut Multipart,
) -> Result<ParsedImportMultipart, (StatusCode, Json<ApiErrorResponse>)> {
    let mut file_name = None;
    let mut file_bytes = None;
    let mut account_id = None;
    let mut csv_mapping = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| api_bad_request("Invalid multipart request"))?
    {
        let field_name = field.name().map(str::to_string).unwrap_or_default();
        match field_name.as_str() {
            "file" => {
                file_name = field.file_name().map(str::to_string);
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| api_bad_request("Unable to read uploaded file"))?;
                file_bytes = Some(bytes.to_vec());
            }
            "account_id" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| api_bad_request("Unable to read account_id"))?;
                account_id = Some(
                    Uuid::parse_str(value.trim())
                        .map_err(|_| api_bad_request("account_id must be a valid UUID"))?,
                );
            }
            "csv_mapping" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| api_bad_request("Unable to read csv_mapping"))?;
                csv_mapping = Some(
                    serde_json::from_str(&value)
                        .map_err(|_| api_bad_request("csv_mapping must be valid JSON"))?,
                );
            }
            _ => {
                let _ = field
                    .bytes()
                    .await
                    .map_err(|_| api_bad_request("Unable to read multipart field"))?;
            }
        }
    }

    let file_name = file_name.ok_or_else(|| api_bad_request("file is required"))?;
    let file_bytes = file_bytes.ok_or_else(|| api_bad_request("file is required"))?;
    let account_id = account_id.ok_or_else(|| api_bad_request("account_id is required"))?;

    Ok(ParsedImportMultipart {
        file_name,
        file_bytes,
        account_id,
        csv_mapping,
    })
}

fn api_bad_request(message: impl Into<String>) -> (StatusCode, Json<ApiErrorResponse>) {
    DomainError::bad_request(message).into()
}
