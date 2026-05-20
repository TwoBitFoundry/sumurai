import type { CsvColumnMapping } from '@/models/import';

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

export function isMappingComplete(mapping: CsvColumnMapping): boolean {
  if (!hasMappedColumn(mapping.date_column) || !hasMappedColumn(mapping.description_column)) {
    return false;
  }

  if (mappingUsesSplitAmount(mapping)) {
    return hasMappedColumn(mapping.debit_column) && hasMappedColumn(mapping.credit_column);
  }

  return hasMappedColumn(mapping.amount_column);
}
