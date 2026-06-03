import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SyncAllStatusToast } from '@/features/sync/components/SyncAllStatusToast';
import type { SyncAllRow } from '@/features/sync/types/syncAllStatus';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

const rows: SyncAllRow[] = [
  {
    id: 'bank-1',
    provider: 'plaid',
    institutionName: 'Demo Bank',
    connectionId: 'conn-1',
    status: 'synced',
    detail: 'Synced successfully',
    transactionCount: 3,
    retryAfterSeconds: null,
  },
];

const issueRows: SyncAllRow[] = [
  {
    id: 'bank-2',
    provider: 'teller',
    institutionName: 'Issue Bank',
    connectionId: 'conn-2',
    status: 'rate_limited',
    detail: null,
    transactionCount: null,
    retryAfterSeconds: 7200,
  },
];

function TestHarness() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <SyncAllStatusToast
      isOpen={isOpen}
      syncingAll={false}
      rows={rows}
      onClose={() => setIsOpen(false)}
    />
  );
}

function IssueHarness() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <SyncAllStatusToast
      isOpen={isOpen}
      syncingAll={false}
      rows={issueRows}
      onClose={() => setIsOpen(false)}
    />
  );
}

describe('SyncAllStatusToast', () => {
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

  it('shows a visible dismiss countdown and auto-closes after five seconds', async () => {
    render(<TestHarness />);

    expect(screen.getByRole('button', { name: /close sync results in 5s/i })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /close sync results in 4s/i })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('sync-all-toast')).not.toBeInTheDocument();
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

    expect(screen.getByTestId('sync-all-toast')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /close sync results in/i })
    ).not.toBeInTheDocument();
  });
});
