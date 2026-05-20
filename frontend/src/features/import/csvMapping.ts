/**
 * Maps imported CSV columns into transaction fields.
 */

import { type CsvColumnMapping, isCsvImportFormat, type ValidateResponse } from '@/models/import';

export const CSV_NO_TRANSACTION_ROWS_ERROR = 'No transaction rows were found in the CSV file';

export function resolveMappedHeader(headers: string[], value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = headers.find((header) => header.trim().toLowerCase() === normalized);
  return match ?? value;
}

export function normalizeCsvMapping(
  mapping: CsvColumnMapping,
  headers: string[]
): CsvColumnMapping {
  return {
    date_column: resolveMappedHeader(headers, mapping.date_column),
    description_column: resolveMappedHeader(headers, mapping.description_column),
    amount_column: resolveMappedHeader(headers, mapping.amount_column),
    debit_column: resolveMappedHeader(headers, mapping.debit_column),
    credit_column: resolveMappedHeader(headers, mapping.credit_column),
  };
}

function hasMappedColumn(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function mappingUsesSplitAmount(mapping: CsvColumnMapping): boolean {
  return (
    (hasMappedColumn(mapping.debit_column) || hasMappedColumn(mapping.credit_column)) &&
    !hasMappedColumn(mapping.amount_column)
  );
}

export function isHeaderOnlyCsvValidation(result: ValidateResponse): boolean {
  return (
    result.transaction_count === 0 &&
    result.errors.some((message) => message.includes(CSV_NO_TRANSACTION_ROWS_ERROR))
  );
}

export function canCorrectCsvMapping(result: ValidateResponse): boolean {
  if (!isCsvImportFormat(result.format)) {
    return false;
  }

  const hasHeaders = result.csv_headers.length > 0 || (result.sample_csv_rows[0]?.length ?? 0) > 0;
  if (!hasHeaders || isHeaderOnlyCsvValidation(result)) {
    return false;
  }

  return true;
}

export function isMappingComplete(mapping: CsvColumnMapping): boolean {
  if (!hasMappedColumn(mapping.date_column) || !hasMappedColumn(mapping.description_column)) {
    return false;
  }

  if (mappingUsesSplitAmount(mapping)) {
    return hasMappedColumn(mapping.debit_column) && hasMappedColumn(mapping.credit_column);
  }

  return hasMappedColumn(mapping.amount_column);
}
