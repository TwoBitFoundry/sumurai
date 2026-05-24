import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useAutoCategorization } from '@/features/auto-categorization/hooks/useAutoCategorization';
import type { AutoCategorizationJobState } from '@/types/api';

const invalidateCategorizationDependentQueries = jest.fn().mockResolvedValue(undefined);

jest.mock('@/utils/queryInvalidation', () => ({
  invalidateCategorizationDependentQueries: (...args: unknown[]) =>
    invalidateCategorizationDependentQueries(...args),
}));

jest.mock('@/services/AutoCategorizationService', () => ({
  AutoCategorizationService: {
    getStatus: jest.fn(),
    start: jest.fn(),
    cancel: jest.fn(),
  },
}));

const autoCategorizationServiceMock = jest.requireMock('@/services/AutoCategorizationService')
  .AutoCategorizationService as {
  getStatus: jest.Mock;
  start: jest.Mock;
  cancel: jest.Mock;
};

const runningJob: AutoCategorizationJobState = {
  job_id: '11111111-2222-3333-4444-555555555555',
  status: 'running',
  total: 12,
  processed: 4,
  updated: 3,
  skipped: 1,
  started_at: '2024-01-01T12:00:00Z',
  finished_at: null,
  error_message: null,
};

const completedJob: AutoCategorizationJobState = {
  ...runningJob,
  status: 'completed',
  processed: 12,
  finished_at: '2024-01-01T12:05:00Z',
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAutoCategorization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    jest.clearAllMocks();
    autoCategorizationServiceMock.getStatus.mockResolvedValue(null);
    autoCategorizationServiceMock.start.mockResolvedValue(runningJob);
    autoCategorizationServiceMock.cancel.mockResolvedValue({
      ...runningJob,
      status: 'cancelling',
    });
  });

  it('restores active job state from the status endpoint on load', async () => {
    autoCategorizationServiceMock.getStatus.mockResolvedValue(runningJob);

    const { result } = renderHook(() => useAutoCategorization(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    expect(result.current.job).toEqual(runningJob);
    expect(result.current.progressLabel).toBe('4 / 12 processed');
  });

  it('starts a run when handleAction is called while idle', async () => {
    const { result } = renderHook(() => useAutoCategorization(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleAction();
    });

    expect(autoCategorizationServiceMock.start).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });
  });

  it('cancels a run when handleAction is called while active', async () => {
    autoCategorizationServiceMock.getStatus.mockResolvedValue(runningJob);

    const { result } = renderHook(() => useAutoCategorization(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    await act(async () => {
      await result.current.handleAction();
    });

    expect(autoCategorizationServiceMock.cancel).toHaveBeenCalledTimes(1);
  });

  it('invalidates categorization-dependent queries after a terminal transition', async () => {
    autoCategorizationServiceMock.getStatus
      .mockResolvedValueOnce(runningJob)
      .mockResolvedValueOnce(completedJob);

    const { result, rerender } = renderHook(() => useAutoCategorization(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    queryClient.setQueryData(['auto-categorization', 'status'], completedJob);
    rerender();

    await waitFor(() => {
      expect(invalidateCategorizationDependentQueries).toHaveBeenCalledWith(queryClient);
    });
  });
});
