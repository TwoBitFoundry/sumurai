import { useCallback, useState } from 'react';
import { ExportService } from '@/services/ExportService';
import type { ExportFormat } from '@/types/api';

export interface ExportGateway {
  exportAccounts: (format: ExportFormat, connectionId?: string) => Promise<void>;
}

export interface UseExportOptions {
  service?: ExportGateway;
}

export interface UseExportResult {
  isExporting: boolean;
  error: string | null;
  toast: string | null;
  exportAccounts: (format: ExportFormat, connectionId?: string) => Promise<void>;
}

const defaultService: ExportGateway = {
  exportAccounts: (format, connectionId) => ExportService.exportAccounts(format, connectionId),
};

export function useExport(options: UseExportOptions = {}): UseExportResult {
  const service = options.service ?? defaultService;
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const exportAccounts = useCallback(
    async (format: ExportFormat, connectionId?: string) => {
      setIsExporting(true);
      setError(null);
      try {
        await service.exportAccounts(format, connectionId);
        setToast(`Export ${format} download started`);
      } catch (exportError: unknown) {
        const message =
          exportError instanceof Error ? exportError.message : 'Failed to export accounts';
        setError(message);
        setToast(`Export failed: ${message}`);
      } finally {
        setIsExporting(false);
      }
    },
    [service]
  );

  return {
    isExporting,
    error,
    toast,
    exportAccounts,
  };
}
