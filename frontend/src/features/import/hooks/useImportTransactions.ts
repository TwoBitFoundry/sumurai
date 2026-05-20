/**
 * Drives transaction import upload and result handling.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { canCorrectCsvMapping, normalizeCsvMapping } from '@/features/import/csvMapping';
import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import { ImportService } from '@/services/ImportService';
import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';

export type ImportWorkflowStatus =
  | 'idle'
  | 'validating'
  | 'preview'
  | 'validation-error'
  | 'importing'
  | 'success'
  | 'error';

export interface UseImportTransactionsResult {
  status: ImportWorkflowStatus;
  selectedFile: File | null;
  validationResult: ValidateResponse | null;
  importResult: ImportResponse | null;
  csvMapping: CsvColumnMapping | null;
  error: string | null;
  validateFile: (file: File) => Promise<ValidateResponse | null>;
  importFile: (file?: File, mapping?: CsvColumnMapping) => Promise<ImportResponse | null>;
  setCsvMapping: (mapping: CsvColumnMapping | null) => void;
  reset: () => void;
  backToPreview: () => void;
}

const DEFAULT_VALIDATION_ERROR = 'We could not validate this file.';
const DEFAULT_IMPORT_ERROR = 'We could not import this file.';

export function useImportTransactions(accountId: string): UseImportTransactionsResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ImportWorkflowStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [csvMapping, setCsvMappingState] = useState<CsvColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const csvMappingRef = useRef<CsvColumnMapping | null>(null);

  const applySelectedFile = useCallback((file: File | null) => {
    selectedFileRef.current = file;
    setSelectedFile(file);
  }, []);

  const setCsvMapping = useCallback((mapping: CsvColumnMapping | null) => {
    csvMappingRef.current = mapping;
    setCsvMappingState(mapping);
  }, []);

  const validateFile = useCallback(
    async (file: File): Promise<ValidateResponse | null> => {
      applySelectedFile(file);
      setImportResult(null);
      setValidationResult(null);
      setError(null);
      setStatus('validating');

      try {
        const result = await ImportService.validate(file, accountId);
        setValidationResult(result);
        const headers = result.csv_headers.length
          ? result.csv_headers
          : (result.sample_csv_rows[0] ?? []);
        setCsvMapping(
          result.suggested_csv_mapping
            ? normalizeCsvMapping(result.suggested_csv_mapping, headers)
            : null
        );

        if (!result.valid) {
          if (canCorrectCsvMapping(result)) {
            setError(errorMessageFromValidation(result));
            setStatus('preview');
            return result;
          }

          setError(errorMessageFromValidation(result));
          setStatus('validation-error');
          return result;
        }

        setStatus('preview');
        return result;
      } catch (err: unknown) {
        setError(errorMessageFromUnknown(err, DEFAULT_VALIDATION_ERROR));
        setStatus('validation-error');
        return null;
      }
    },
    [accountId, applySelectedFile, setCsvMapping]
  );

  const importFile = useCallback(
    async (file?: File, mapping?: CsvColumnMapping): Promise<ImportResponse | null> => {
      const fileToImport = file ?? selectedFileRef.current;
      const mappingToImport = mapping ?? csvMappingRef.current ?? undefined;

      if (!fileToImport) {
        setError('Choose a file before importing transactions.');
        setStatus('error');
        return null;
      }

      applySelectedFile(fileToImport);
      if (mapping !== undefined) {
        setCsvMapping(mapping);
      }
      setImportResult(null);
      setError(null);
      setStatus('importing');

      try {
        const result = await ImportService.importFile(fileToImport, accountId, mappingToImport);
        setImportResult(result);
        await invalidateStaleCacheQueries(queryClient, ['plaid', 'teller']);
        setStatus('success');
        return result;
      } catch (err: unknown) {
        setError(errorMessageFromUnknown(err, DEFAULT_IMPORT_ERROR));
        setStatus('error');
        return null;
      }
    },
    [accountId, applySelectedFile, queryClient, setCsvMapping]
  );

  const reset = useCallback(() => {
    applySelectedFile(null);
    setValidationResult(null);
    setImportResult(null);
    setCsvMapping(null);
    setError(null);
    setStatus('idle');
  }, [applySelectedFile, setCsvMapping]);

  const backToPreview = useCallback(() => {
    if (
      selectedFileRef.current &&
      validationResult &&
      (validationResult.valid || canCorrectCsvMapping(validationResult))
    ) {
      setImportResult(null);
      setError(null);
      setStatus('preview');
      return;
    }

    setError(null);
    setStatus('idle');
  }, [validationResult]);

  return {
    status,
    selectedFile,
    validationResult,
    importResult,
    csvMapping,
    error,
    validateFile,
    importFile,
    setCsvMapping,
    reset,
    backToPreview,
  };
}

function errorMessageFromValidation(result: ValidateResponse): string {
  return result.errors.find((message) => message.trim().length > 0) ?? DEFAULT_VALIDATION_ERROR;
}

function errorMessageFromUnknown(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim().length > 0 ? err.message : fallback;
}
