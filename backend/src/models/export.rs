use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
#[schema(example = json!("csv"))]
pub enum ExportFormat {
    Csv,
    Ofx,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[allow(dead_code)]
pub struct ExportQuery {
    pub format: ExportFormat,
    pub connection_id: Option<Uuid>,
}

impl ExportFormat {
    pub fn file_extension(self) -> &'static str {
        match self {
            ExportFormat::Csv => "csv",
            ExportFormat::Ofx => "ofx",
        }
    }

    #[allow(dead_code)]
    pub fn content_type(self) -> &'static str {
        match self {
            ExportFormat::Csv => "text/csv",
            ExportFormat::Ofx => "application/x-ofx",
        }
    }

    pub fn filename_for_scope(
        self,
        scope: &str,
        date_range: Option<(NaiveDate, NaiveDate)>,
    ) -> String {
        let scope = sanitize_filename_component(scope);
        let range = match date_range {
            Some((start, end)) => format!("{}-{}", start.format("%Y%m%d"), end.format("%Y%m%d")),
            None => String::from("no-transactions"),
        };

        format!(
            "sumurai-export-{}-{}.{}",
            scope,
            range,
            self.file_extension()
        )
    }
}

fn sanitize_filename_component(value: &str) -> String {
    let mut result = String::new();
    let mut was_dash = false;

    for ch in value.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch);
            was_dash = false;
        } else if !was_dash {
            result.push('-');
            was_dash = true;
        }
    }

    let trimmed = result.trim_matches('-').to_string();
    if trimmed.is_empty() {
        String::from("export")
    } else {
        trimmed
    }
}
