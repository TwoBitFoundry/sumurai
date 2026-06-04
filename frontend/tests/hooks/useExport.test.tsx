import { act, renderHook, waitFor } from '@testing-library/react';
import { useExport } from '@/hooks/useExport';
import type { ExportFormat } from '@/types/api';

describe('useExport', () => {
  it('tracks loading state, calls the service, and reports success', async () => {
    const exportAccounts = jest.fn().mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useExport({
        service: { exportAccounts },
      })
    );

    await act(async () => {
      await result.current.exportAccounts('csv' as ExportFormat);
    });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(false);
    });

    expect(exportAccounts).toHaveBeenCalledWith('csv', undefined);
    expect(result.current.toast).toBe('Export csv download started');
    expect(result.current.error).toBeNull();
  });

  it('reports failures through error and toast state', async () => {
    const exportAccounts = jest.fn().mockRejectedValueOnce(new Error('Download failed'));

    const { result } = renderHook(() =>
      useExport({
        service: { exportAccounts },
      })
    );

    await act(async () => {
      await result.current.exportAccounts('ofx' as ExportFormat, 'conn-1');
    });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(false);
    });

    expect(exportAccounts).toHaveBeenCalledWith('ofx', 'conn-1');
    expect(result.current.error).toBe('Download failed');
    expect(result.current.toast).toBe('Export failed: Download failed');
  });
});
