use chrono::{NaiveDate, Utc};
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

    pub fn filename_for_date(self, date: NaiveDate) -> String {
        format!(
            "sumurai-export-{}.{}",
            date.format("%Y%m%d"),
            self.file_extension()
        )
    }

    #[allow(dead_code)]
    pub fn filename(self) -> String {
        self.filename_for_date(Utc::now().date_naive())
    }
}
