export type ImportFileFormat = 'Csv' | 'Ofx' | 'Qfx' | 'Qbo' | 'Qbx';

const importFormatLabels: Record<ImportFileFormat, string> = {
  Csv: 'CSV',
  Ofx: 'OFX',
  Qfx: 'QFX',
  Qbo: 'QBO',
  Qbx: 'QBX',
};

export function importFormatLabel(format: ImportFileFormat): string {
  return importFormatLabels[format];
}

export const importSupportedFileFormats: ImportFileFormat[] = ['Csv', 'Ofx', 'Qbo', 'Qfx', 'Qbx'];

export function isCsvImportFormat(format: ImportFileFormat | null | undefined): boolean {
  return format === 'Csv';
}

export interface CsvColumnMapping {
  date_column: string | null;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  description_column: string | null;
}

export interface ImportDateRange {
  start_date: string;
  end_date: string;
}

export interface PreviewTransaction {
  date: string;
  amount: string;
  description: string;
}

export interface ValidateResponse {
  valid: boolean;
  format: ImportFileFormat | null;
  transaction_count: number;
  truncated_count: number;
  date_range: ImportDateRange | null;
  preview_rows: PreviewTransaction[];
  suggested_csv_mapping: CsvColumnMapping | null;
  csv_headers: string[];
  sample_csv_rows: string[][];
  errors: string[];
}

export interface ImportResponse {
  imported_count: number;
  skipped_count: number;
  truncated_count: number;
  total_parsed: number;
  errors: string[];
}
