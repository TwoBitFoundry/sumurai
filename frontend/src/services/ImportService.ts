/**
 * API access for transaction import uploads.
 */

import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import { ApiClient } from './ApiClient';

export class ImportService {
  static async validate(file: File, accountId: string): Promise<ValidateResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);

    return ApiClient.postFormData<ValidateResponse>('/transactions/import/validate', formData);
  }

  static async importFile(
    file: File,
    accountId: string,
    csvMapping?: CsvColumnMapping
  ): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);

    if (csvMapping) {
      formData.append('csv_mapping', JSON.stringify(csvMapping));
    }

    return ApiClient.postFormData<ImportResponse>('/transactions/import', formData);
  }
}
