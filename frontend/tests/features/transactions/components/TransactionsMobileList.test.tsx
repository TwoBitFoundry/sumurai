import { render, screen } from '@testing-library/react';
import { TransactionsMobileList } from '@/features/transactions/components/TransactionsMobileList';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Transaction } from '@/types/api';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

jest.mock('@/features/transactions/components/InlineCategoryCell', () => ({
  __esModule: true,
  default: ({ transaction, dense }: { transaction: Transaction; dense?: boolean }) => (
    <span data-testid="inline-category-cell" data-dense={dense ? 'true' : 'false'}>
      {transaction.category?.primary}
    </span>
  ),
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-05-21',
  name: 'Bank Of All',
  amount: 69.65,
  category: { primary: 'GENERAL_MERCHANDISE' },
  account_name: 'Platinum Card',
  account_mask: '6017',
};

const listProps = {
  items: [transaction],
  currentPage: 1,
  pageSize: 8,
  animationKey: 'page-1',
};

describe('TransactionsMobileList', () => {
  beforeEach(() => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it('renders a stacked compact row without a table', () => {
    render(
      <TransactionsMobileList
        items={[transaction]}
        currentPage={1}
        pageSize={8}
        animationKey="page-1"
      />
    );

    expect(screen.getByTestId('transactions-mobile-list')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Bank Of All')).toBeInTheDocument();
    expect(screen.getByText('$69.65')).toBeInTheDocument();
    expect(screen.getByText('May 21, 2026')).toBeInTheDocument();
    expect(screen.getByTitle(/Platinum Card/)).toBeInTheDocument();
    expect(screen.getByText(/Platinum Card/)).toBeInTheDocument();
    expect(screen.getByText(/6017/)).toBeInTheDocument();
    expect(screen.getByTestId('inline-category-cell')).toHaveAttribute('data-dense', 'true');
  });

  it('uses standard inline pills on tablet', () => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'tablet',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });

    render(<TransactionsMobileList {...listProps} />);

    expect(screen.getByTestId('inline-category-cell')).toHaveAttribute('data-dense', 'false');
  });

  it('applies ellipsis styling to long merchant names', () => {
    render(
      <TransactionsMobileList
        items={[
          {
            ...transaction,
            name: 'International Conglomerate Of Very Long Business Names LLC',
          },
        ]}
        currentPage={1}
        pageSize={8}
        animationKey="page-1"
      />
    );

    const merchant = screen.getByTitle(
      'International Conglomerate Of Very Long Business Names LLC'
    );
    expect(merchant.className).toContain('text-ellipsis');
    expect(merchant.className).toContain('overflow-hidden');
  });

  it('includes the year on the meta line for every transaction', () => {
    render(<TransactionsMobileList {...listProps} />);

    expect(screen.getByTitle(/2026/)).toBeInTheDocument();
  });

  it('stacks the date above the account label', () => {
    render(<TransactionsMobileList {...listProps} />);

    const dateLine = screen.getByText('May 21, 2026');
    const accountLine = screen.getByText(/Platinum Card/);

    expect(
      dateLine.compareDocumentPosition(accountLine) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('reserves full-height space for placeholder rows', () => {
    const { container } = render(
      <TransactionsMobileList items={[]} currentPage={1} pageSize={8} animationKey="page-1" />
    );

    expect(container.querySelector('li[aria-hidden="true"]')?.className).toContain(
      'min-h-[5.25rem]'
    );
  });
});
