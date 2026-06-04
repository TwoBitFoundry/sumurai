use chrono::NaiveDate;

use crate::models::export::ExportFormat;

#[test]
fn given_export_format_when_formatting_then_uses_expected_filename_and_content_type() {
    assert_eq!(ExportFormat::Csv.file_extension(), "csv");
    assert_eq!(ExportFormat::Csv.content_type(), "text/csv");
    assert_eq!(
        ExportFormat::Csv.filename_for_scope(
            "all",
            Some((
                NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()
            ))
        ),
        "sumurai-export-all-20240110-20240115.csv"
    );
    assert_eq!(ExportFormat::Ofx.file_extension(), "ofx");
    assert_eq!(ExportFormat::Ofx.content_type(), "application/x-ofx");
    assert_eq!(
        ExportFormat::Ofx.filename_for_scope(
            "Demo Bank",
            Some((
                NaiveDate::from_ymd_opt(2024, 1, 10).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()
            ))
        ),
        "sumurai-export-demo-bank-20240110-20240115.ofx"
    );
}
