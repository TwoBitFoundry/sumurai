import {
  CSV_NO_TRANSACTION_ROWS_ERROR,
  canCorrectCsvMapping,
  isHeaderOnlyCsvValidation,
  isMappingComplete,
  mappingUsesSplitAmount,
  normalizeCsvMapping,
  resolveMappedHeader,
} from '@/features/import/csvMapping';
import type { CsvColumnMapping, ValidateResponse } from '@/models/import';

const headers = ['DATE', 'DESCRIPTION', 'AMOUNT', 'Debit Amount', 'Credit Amount'];

const baseValidation: ValidateResponse = {
  valid: false,
  format: 'Csv',
  transaction_count: 0,
  truncated_count: 0,
  date_range: null,
  preview_rows: [],
  suggested_csv_mapping: {
    date_column: null,
    amount_column: null,
    debit_column: 'Debit Amount',
    credit_column: 'Credit Amount',
    description_column: 'Memo',
  },
  csv_headers: ['Posted On', 'Memo', 'Debit Amount', 'Credit Amount'],
  sample_csv_rows: [['Posted On', 'Memo', 'Debit Amount', 'Credit Amount']],
  errors: ['Unable to detect a CSV date column'],
};

describe('csvMapping', () => {
  it('resolves mapped headers case-insensitively', () => {
    expect(resolveMappedHeader(headers, 'date')).toBe('DATE');
    expect(resolveMappedHeader(headers, 'Debit Amount')).toBe('Debit Amount');
    expect(resolveMappedHeader(headers, 'missing')).toBe('missing');
    expect(resolveMappedHeader(headers, null)).toBeNull();
  });

  it('normalizes every mapping field against available headers', () => {
    const mapping: CsvColumnMapping = {
      date_column: 'date',
      description_column: 'description',
      amount_column: 'amount',
      debit_column: 'debit amount',
      credit_column: 'credit amount',
    };

    expect(normalizeCsvMapping(mapping, headers)).toEqual({
      date_column: 'DATE',
      description_column: 'DESCRIPTION',
      amount_column: 'AMOUNT',
      debit_column: 'Debit Amount',
      credit_column: 'Credit Amount',
    });
  });

  it('detects split amount mapping when debit or credit is set without amount', () => {
    expect(
      mappingUsesSplitAmount({
        date_column: 'Date',
        description_column: 'Description',
        amount_column: null,
        debit_column: 'Debit Amount',
        credit_column: null,
      })
    ).toBe(true);
    expect(
      mappingUsesSplitAmount({
        date_column: 'Date',
        description_column: 'Description',
        amount_column: 'Amount',
        debit_column: null,
        credit_column: null,
      })
    ).toBe(false);
  });

  it('allows csv remapping when headers exist but auto-detect failed', () => {
    expect(canCorrectCsvMapping(baseValidation)).toBe(true);
    expect(isHeaderOnlyCsvValidation(baseValidation)).toBe(false);
  });

  it('blocks csv remapping for header-only files', () => {
    const headerOnly: ValidateResponse = {
      ...baseValidation,
      errors: [CSV_NO_TRANSACTION_ROWS_ERROR],
    };

    expect(canCorrectCsvMapping(headerOnly)).toBe(false);
    expect(isHeaderOnlyCsvValidation(headerOnly)).toBe(true);
  });

  it('requires every visible mapping field before import is allowed', () => {
    const base = {
      date_column: 'Date',
      description_column: 'Description',
      amount_column: null,
      debit_column: null,
      credit_column: null,
    };

    expect(isMappingComplete({ ...base, amount_column: 'Amount' })).toBe(true);
    expect(isMappingComplete({ ...base, amount_column: null })).toBe(false);
    expect(
      isMappingComplete({
        ...base,
        debit_column: 'Debit Amount',
        credit_column: 'Credit Amount',
      })
    ).toBe(true);
    expect(
      isMappingComplete({
        ...base,
        debit_column: 'Debit Amount',
        credit_column: null,
      })
    ).toBe(false);
  });
});
