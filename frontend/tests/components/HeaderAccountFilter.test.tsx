import { render, screen } from '@testing-library/react';
import { HeaderAccountFilter } from '@/components/HeaderAccountFilter';
import { useAccountFilter } from '@/hooks/useAccountFilter';

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

describe('HeaderAccountFilter', () => {
  beforeEach(() => {
    jest.mocked(useAccountFilter).mockReturnValue({
      isAllAccountsSelected: true,
      selectedAccountIds: ['account1', 'account2'],
      allAccountIds: ['account1', 'account2'],
      accountsByBank: {
        'Mock Bank': [
          {
            id: 'account1',
            name: 'Mock Checking',
            account_type: 'depository',
            balance_ledger: 100,
            balance_available: 100,
            mask: '1111',
            provider: 'plaid',
            institution_name: 'Mock Bank',
            connection_id: 'connection-1',
            transaction_count: 2,
          },
        ],
      },
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    });
  });

  it('keeps the trigger size fixed when scrolled changes', () => {
    const { rerender } = render(<HeaderAccountFilter />);
    const initialClassName = screen.getByRole('button', { name: 'Filter' }).className;

    rerender(<HeaderAccountFilter />);

    expect(screen.getByRole('button', { name: 'Filter' }).className).toBe(initialClassName);
  });
});
