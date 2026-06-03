import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SyncInstitutionStatusToast } from '@/features/sync/components/SyncInstitutionStatusToast';
import type { SyncAllRow } from '@/features/sync/types/syncAllStatus';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

const syncedRow: SyncAllRow = {
  id: 'bank-1',
  provider: 'plaid',
  institutionName: 'Demo Bank',
  connectionId: 'conn-1',
  status: 'synced',
  detail: 'Synced 1 new transaction',
  transactionCount: 1,
  retryAfterSeconds: null,
};

const issueRow: SyncAllRow = {
  id: 'bank-2',
  provider: 'teller',
  institutionName: 'Issue Bank',
  connectionId: 'conn-2',
  status: 'rate_limited',
  detail: null,
  transactionCount: null,
  retryAfterSeconds: 7200,
};

function SuccessHarness() {
  const [row, setRow] = useState<SyncAllRow | null>(syncedRow);

  return <SyncInstitutionStatusToast row={row} onClose={() => setRow(null)} />;
}

function IssueHarness() {
  const [row, setRow] = useState<SyncAllRow | null>(issueRow);

  return <SyncInstitutionStatusToast row={row} onClose={() => setRow(null)} />;
}

describe('SyncInstitutionStatusToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a checklist-style single sync card and auto-closes after five seconds on success', async () => {
    render(<SuccessHarness />);

    expect(screen.getByRole('heading', { name: 'Sync institution' })).toBeVisible();
    expect(screen.getByText('Demo Bank')).toBeVisible();
    expect(screen.getByText('Synced 1 new transaction')).toBeVisible();
    expect(screen.getByRole('button', { name: /close sync results in 5s/i })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /close sync results in 4s/i })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('sync-institution-toast')).not.toBeInTheDocument();
    });
  });

  it('stays open on issue rows until dismissed manually', async () => {
    render(<IssueHarness />);

    expect(screen.getByRole('button', { name: 'Close sync results' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /close sync results in/i })
    ).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('sync-institution-toast')).toBeInTheDocument();
  });
});
