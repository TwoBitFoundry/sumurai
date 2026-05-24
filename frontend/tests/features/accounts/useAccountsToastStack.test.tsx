import { act, renderHook } from '@testing-library/react';
import { useAccountsToastStack } from '@/features/accounts/hooks/useAccountsToastStack';
import type { AutoCategorizationJobState } from '@/types/api';

const runningJob: AutoCategorizationJobState = {
  job_id: 'job-running',
  status: 'running',
  total: 6,
  processed: 2,
  updated: 1,
  skipped: 1,
  started_at: '2024-01-01T12:00:00Z',
  finished_at: null,
  error_message: null,
};

const completedJob: AutoCategorizationJobState = {
  ...runningJob,
  status: 'completed',
  processed: 6,
  finished_at: '2024-01-01T12:05:00Z',
};

describe('useAccountsToastStack', () => {
  it('shows a pinned progress toast while the job is active', () => {
    const { result } = renderHook(() => useAccountsToastStack(runningJob));

    expect(result.current.pinnedToast?.autoDismiss).toBe(false);
    expect(result.current.pinnedToast?.message).toBe('Categorizing transactions…');
    expect(result.current.pinnedToast?.progress).toEqual({ processed: 2, total: 6 });
  });

  it('keeps progress dismissed for the current run after manual close', () => {
    const { result } = renderHook(() => useAccountsToastStack(runningJob));

    act(() => {
      result.current.dismissPinned();
    });

    expect(result.current.pinnedToast).toBeNull();
  });

  it('adds transient toasts without replacing pinned progress', () => {
    const { result } = renderHook(() => useAccountsToastStack(runningJob));

    act(() => {
      result.current.pushToast('Bank connected');
    });

    expect(result.current.transients).toHaveLength(1);
    expect(result.current.pinnedToast).not.toBeNull();
  });

  it('converts to a terminal auto-dismiss toast when the job finishes', () => {
    const { result, rerender } = renderHook(
      ({ job }: { job: AutoCategorizationJobState | null }) => useAccountsToastStack(job),
      { initialProps: { job: runningJob as AutoCategorizationJobState | null } }
    );

    rerender({ job: completedJob });

    expect(result.current.pinnedToast?.autoDismiss).toBe(true);
    expect(result.current.pinnedToast?.message).toContain('Categorization complete');
  });

  it('does not reopen terminal toast after progress was dismissed for that run', () => {
    const { result, rerender } = renderHook(
      ({ job }: { job: AutoCategorizationJobState | null }) => useAccountsToastStack(job),
      { initialProps: { job: runningJob as AutoCategorizationJobState | null } }
    );

    act(() => {
      result.current.dismissPinned();
    });

    rerender({ job: completedJob });

    expect(result.current.pinnedToast).toBeNull();
  });
});
