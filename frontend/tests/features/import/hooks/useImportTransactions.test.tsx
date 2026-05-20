import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useImportTransactions } from '@/features/import/hooks/useImportTransactions';
import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import { ImportService } from '@/services/ImportService';
import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';

jest.mock('@/services/ImportService', () => ({
  ImportService: {
    validate: jest.fn(),
    importFile: jest.fn(),
  },
}));

jest.mock('@/utils/queryInvalidation', () => ({
  invalidateStaleCacheQueries: jest.fn().mockResolvedValue(undefined),
}));

const validateResponse: ValidateResponse = {
  valid: true,
  format: 'Csv',
  transaction_count: 2,
  truncated_count: 0,
  date_range: {
    start_date: '2024-01-01',
    end_date: '2024-01-02',
  },
  preview_rows: [
    {
      date: '2024-01-01',
      amount: '10.00',
      description: 'Coffee',
    },
  ],
  suggested_csv_mapping: {
    date_column: 'Date',
    amount_column: null,
    debit_column: 'Debit',
    credit_column: 'Credit',
    description_column: 'Description',
  },
  csv_headers: ['Date', 'Description', 'Debit', 'Credit'],
  sample_csv_rows: [['Date', 'Description', 'Debit', 'Credit']],
  errors: [],
};

const importResponse: ImportResponse = {
  imported_count: 2,
  skipped_count: 0,
  truncated_count: 0,
  total_parsed: 2,
  errors: [],
};

function makeFile(name = 'transactions.csv') {
  return new File(['Date,Description,Debit,Credit'], name, { type: 'text/csv' });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    queryClient,
    wrapper: makeWrapper(queryClient),
  };
}

describe('useImportTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates a selected file and opens preview state', async () => {
    const file = makeFile();
    const validation = deferred<ValidateResponse>();
    jest.mocked(ImportService.validate).mockReturnValue(validation.promise);
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      void result.current.validateFile(file);
    });

    expect(result.current.status).toBe('validating');

    await act(async () => {
      validation.resolve(validateResponse);
      await validation.promise;
    });

    expect(ImportService.validate).toHaveBeenCalledWith(file, 'account-1');
    expect(result.current.status).toBe('preview');
    expect(result.current.selectedFile).toBe(file);
    expect(result.current.validationResult).toBe(validateResponse);
    expect(result.current.csvMapping).toEqual(validateResponse.suggested_csv_mapping);
    expect(result.current.error).toBeNull();
  });

  it('moves non-remappable validation failures into validation-error with a useful message', async () => {
    const file = makeFile();
    jest.mocked(ImportService.validate).mockResolvedValue({
      ...validateResponse,
      valid: false,
      format: null,
      csv_headers: [],
      sample_csv_rows: [],
      errors: ['Unsupported file format'],
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
    });

    expect(result.current.status).toBe('validation-error');
    expect(result.current.error).toBe('Unsupported file format');
    expect(result.current.selectedFile).toBe(file);
    expect(result.current.validationResult?.valid).toBe(false);
  });

  it('opens preview when csv auto-detect fails but headers are available to remap', async () => {
    const file = makeFile('posted-on.csv');
    jest.mocked(ImportService.validate).mockResolvedValue({
      ...validateResponse,
      valid: false,
      transaction_count: 0,
      preview_rows: [],
      date_range: null,
      suggested_csv_mapping: {
        date_column: null,
        amount_column: null,
        debit_column: 'Debit',
        credit_column: 'Credit',
        description_column: 'Description',
      },
      csv_headers: ['Posted On', 'Description', 'Debit', 'Credit'],
      sample_csv_rows: [['Posted On', 'Description', 'Debit', 'Credit']],
      errors: ['Unable to detect a CSV date column'],
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
    });

    expect(result.current.status).toBe('preview');
    expect(result.current.error).toBe('Unable to detect a CSV date column');
    expect(result.current.csvMapping).toEqual({
      date_column: null,
      amount_column: null,
      debit_column: 'Debit',
      credit_column: 'Credit',
      description_column: 'Description',
    });
  });

  it('keeps header-only csv validation failures in validation-error', async () => {
    const file = makeFile('headers-only.csv');
    jest.mocked(ImportService.validate).mockResolvedValue({
      ...validateResponse,
      valid: false,
      transaction_count: 0,
      preview_rows: [],
      date_range: null,
      errors: ['No transaction rows were found in the CSV file.'],
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
    });

    expect(result.current.status).toBe('validation-error');
    expect(result.current.error).toBe('No transaction rows were found in the CSV file.');
  });

  it('imports from preview, records success, and invalidates provider caches', async () => {
    const file = makeFile();
    const importing = deferred<ImportResponse>();
    jest.mocked(ImportService.validate).mockResolvedValue(validateResponse);
    jest.mocked(ImportService.importFile).mockReturnValue(importing.promise);
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
    });

    await act(async () => {
      void result.current.importFile();
    });

    expect(result.current.status).toBe('importing');

    await act(async () => {
      importing.resolve(importResponse);
      await importing.promise;
    });

    expect(ImportService.importFile).toHaveBeenCalledWith(
      file,
      'account-1',
      validateResponse.suggested_csv_mapping
    );
    expect(invalidateStaleCacheQueries).toHaveBeenCalledWith(queryClient, ['plaid', 'teller']);
    expect(result.current.status).toBe('success');
    expect(result.current.importResult).toBe(importResponse);
    expect(result.current.error).toBeNull();
  });

  it('preserves preview context after import failure so the user can retry', async () => {
    const file = makeFile();
    const manualMapping: CsvColumnMapping = {
      date_column: 'Date',
      amount_column: 'Amount',
      debit_column: null,
      credit_column: null,
      description_column: 'Description',
    };
    jest.mocked(ImportService.validate).mockResolvedValue(validateResponse);
    jest.mocked(ImportService.importFile).mockRejectedValue(new Error('Import failed'));
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
      result.current.setCsvMapping(manualMapping);
      await result.current.importFile();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Import failed');
    expect(result.current.selectedFile).toBe(file);
    expect(result.current.validationResult).toBe(validateResponse);
    expect(result.current.csvMapping).toEqual(manualMapping);

    act(() => {
      result.current.backToPreview();
    });

    expect(result.current.status).toBe('preview');
    expect(result.current.error).toBeNull();
  });

  it('reset clears import workflow state', async () => {
    const file = makeFile();
    jest.mocked(ImportService.validate).mockResolvedValue(validateResponse);
    jest.mocked(ImportService.importFile).mockResolvedValue(importResponse);
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.validateFile(file);
      await result.current.importFile();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.validationResult).toBeNull();
    expect(result.current.importResult).toBeNull();
    expect(result.current.csvMapping).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('uses the current file and mapping when explicitly provided for import', async () => {
    const file = makeFile('retry.csv');
    const mapping: CsvColumnMapping = {
      date_column: 'Posted',
      amount_column: 'Signed',
      debit_column: null,
      credit_column: null,
      description_column: 'Memo',
    };
    jest.mocked(ImportService.importFile).mockResolvedValue(importResponse);
    const { wrapper } = setup();

    const { result } = renderHook(() => useImportTransactions('account-1'), { wrapper });

    await act(async () => {
      await result.current.importFile(file, mapping);
    });

    expect(ImportService.importFile).toHaveBeenCalledWith(file, 'account-1', mapping);
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });
});
