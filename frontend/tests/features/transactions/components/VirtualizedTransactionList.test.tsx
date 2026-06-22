import { render, screen, waitFor } from '@testing-library/react';
import VirtualizedTransactionList from '@/features/transactions/components/VirtualizedTransactionList';
import { createMerchantScrollRestoreState } from '@/features/transactions/utils/merchantScrollRestore';
import type { Transaction } from '@/types/api';

const useVirtualizerMock = jest.fn();
const measureMock = jest.fn();
const scrollToIndexMock = jest.fn();
const scrollToOffsetMock = jest.fn();

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: unknown) => useVirtualizerMock(options),
}));

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useInfiniteTransactions', () => ({
  PREFETCH_THRESHOLD: 5,
  useInfiniteTransactions: jest.fn(),
}));

jest.mock('@/features/transactions/components/DesktopTransactionRow', () => ({
  __esModule: true,
  default: () => <div data-testid="desktop-row" />,
}));

jest.mock('@/features/transactions/components/MobileTransactionRow', () => ({
  __esModule: true,
  default: () => <div data-testid="mobile-row" />,
}));

import { useInfiniteTransactions } from '@/features/transactions/hooks/useInfiniteTransactions';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-06-14',
  name: 'Sam Block',
  amount: -117.74,
  category: { primary: 'TRANSFER_OUT' },
  account_id: 'account-1',
  account_name: 'My Checking',
  account_mask: '3661',
};

function mockVirtualizer() {
  useVirtualizerMock.mockReturnValue({
    getVirtualItems: () => [{ key: 'desktop-0', index: 0, start: 0, size: 60 }],
    getTotalSize: () => 60,
    measureElement: jest.fn(),
    measure: measureMock,
    scrollToIndex: scrollToIndexMock,
    scrollToOffset: scrollToOffsetMock,
    scrollOffset: 0,
  });
}

function mockTransactions() {
  jest.mocked(useInfiniteTransactions).mockReturnValue({
    rows: [transaction],
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    isInitialLoading: false,
    filterKey: 'default',
  });
}

describe('VirtualizedTransactionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVirtualizer();
    mockTransactions();
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        height: 600,
        width: 1024,
        left: 0,
        right: 1024,
        bottom: 600,
      }),
    });
  });

  it('keys virtual items by layout so desktop measurements do not carry into mobile', () => {
    jest.mocked(useViewportBreakpoint).mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });

    const { rerender } = render(<VirtualizedTransactionList filters={{}} />);

    expect(useVirtualizerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        getItemKey: expect.any(Function),
        estimateSize: expect.any(Function),
      })
    );
    const desktopOptions = useVirtualizerMock.mock.calls.at(-1)?.[0] as {
      getItemKey: (index: number) => string;
      estimateSize: () => number;
    };
    expect(desktopOptions.getItemKey(0)).toBe('desktop-0');
    expect(desktopOptions.estimateSize()).toBe(60);

    jest.mocked(useViewportBreakpoint).mockReturnValue({
      breakpoint: 'tablet',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });

    rerender(<VirtualizedTransactionList filters={{}} />);

    const mobileOptions = useVirtualizerMock.mock.calls.at(-1)?.[0] as {
      getItemKey: (index: number) => string;
      estimateSize: () => number;
    };
    expect(mobileOptions.getItemKey(0)).toBe('mobile-0');
    expect(mobileOptions.estimateSize()).toBe(96);
    expect(measureMock).toHaveBeenCalled();
    expect(scrollToIndexMock).toHaveBeenCalledWith(0);
  });

  it('keeps a visible scrollbar track when the list can scroll', () => {
    jest.mocked(useViewportBreakpoint).mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });

    render(<VirtualizedTransactionList filters={{}} />);

    const listViewport = screen.getByRole('table', { name: 'Transactions' });
    expect(listViewport.className).toContain('overflow-x-hidden');
    expect(listViewport.className).toContain('touch-pan-y');
    expect(listViewport.className).toContain('[scrollbar-gutter:stable]');
    expect(listViewport.className).toContain('[scrollbar-width:thin]');
    expect(listViewport.className).toContain('[&::-webkit-scrollbar]:w-2');
  });

  it('restores the saved scroll offset when clearing a merchant filter from the list', async () => {
    jest.mocked(useViewportBreakpoint).mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });

    const merchantScrollRestoreRef = {
      current: {
        savedOffset: 480,
        shouldRestoreOnNextFilterKey: true,
      },
    };

    jest.mocked(useInfiniteTransactions).mockReturnValue({
      rows: [transaction],
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
      isInitialLoading: false,
      filterKey: 'cleared',
    });

    render(
      <VirtualizedTransactionList
        filters={{}}
        merchantScrollRestoreRef={merchantScrollRestoreRef}
      />
    );

    await waitFor(() => {
      expect(scrollToOffsetMock).toHaveBeenCalledWith(480, { align: 'start' });
    });
    expect(merchantScrollRestoreRef.current).toEqual(createMerchantScrollRestoreState());
  });
});
