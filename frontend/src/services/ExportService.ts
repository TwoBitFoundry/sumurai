import type { ExportFormat } from '@/types/api';
import { ApiClient } from './ApiClient';

const buildExportFilename = (format: ExportFormat): string => {
  return `sumurai-export-all-no-transactions.${format}`;
};

const buildExportEndpoint = (format: ExportFormat, connectionId?: string): string => {
  const params = new URLSearchParams({ format });
  if (connectionId) {
    params.set('connection_id', connectionId);
  }
  return `/export?${params.toString()}`;
};

const triggerDownload = (blob: Blob, filename: string): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export class ExportService {
  static async exportAccounts(format: ExportFormat, connectionId?: string): Promise<void> {
    const { blob, filename } = await ApiClient.getBlob(buildExportEndpoint(format, connectionId));
    triggerDownload(blob, filename ?? buildExportFilename(format));
  }
}
