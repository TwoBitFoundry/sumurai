import { ApiClient } from '@/services/ApiClient';
import { ImportService } from '@/services/ImportService';
import { setupTestBoundaries } from '../setup/setupTestBoundaries';

describe('ImportService', () => {
  let mockHttp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttp = setupTestBoundaries().http;
  });

  it('validate sends file and account_id as form data', async () => {
    const file = new File(['test'], 'test.qfx', { type: 'text/plain' });
    const response = {
      valid: true,
      format: 'Ofx',
      transaction_count: 1,
      truncated_count: 0,
      date_range: null,
      preview_rows: [],
      suggested_csv_mapping: null,
      csv_headers: [],
      sample_csv_rows: [],
      errors: [],
    };
    mockHttp.postFormData.mockResolvedValueOnce(response);

    const result = await ImportService.validate(file, 'account-123');

    expect(result).toEqual(response);
    expect(mockHttp.postFormData).toHaveBeenCalledWith(
      '/transactions/import/validate',
      expect.any(FormData),
      expect.any(Object)
    );

    const formData = mockHttp.postFormData.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('account_id')).toBe('account-123');
    expect(formData.get('csv_mapping')).toBeNull();
  });

  it('importFile only includes csv_mapping when provided', async () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const response = {
      imported_count: 2,
      skipped_count: 1,
      truncated_count: 0,
      total_parsed: 3,
      errors: [],
    };
    mockHttp.postFormData.mockResolvedValueOnce(response);

    const result = await ImportService.importFile(file, 'account-123', {
      date_column: 'Date',
      amount_column: null,
      debit_column: 'Debit Amount',
      credit_column: 'Credit Amount',
      description_column: 'Description',
    });

    expect(result).toEqual(response);
    const formData = mockHttp.postFormData.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('account_id')).toBe('account-123');
    expect(formData.get('csv_mapping')).toBe(
      JSON.stringify({
        date_column: 'Date',
        amount_column: null,
        debit_column: 'Debit Amount',
        credit_column: 'Credit Amount',
        description_column: 'Description',
      })
    );
  });

  it('importFile omits csv_mapping when not provided', async () => {
    const file = new File(['test'], 'test.ofx', { type: 'text/plain' });
    const response = {
      imported_count: 1,
      skipped_count: 0,
      truncated_count: 0,
      total_parsed: 1,
      errors: [],
    };
    mockHttp.postFormData.mockResolvedValueOnce(response);

    await ImportService.importFile(file, 'account-123');

    const formData = mockHttp.postFormData.mock.calls[0][1] as FormData;
    expect(formData.get('csv_mapping')).toBeNull();
  });
});
