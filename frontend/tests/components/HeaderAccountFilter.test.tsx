import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders an icon-only trigger and opens the popover above the trigger opening to the right', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });

    render(<HeaderAccountFilter triggerStyle="icon-only" />);

    const trigger = screen.getByRole('button', { name: 'Filter accounts' });
    expect(trigger.parentElement?.className).toContain('h-12');
    expect(trigger.parentElement?.className).toContain('w-12');
    expect(trigger.className).toContain('rounded-lg');
    expect(trigger.className).toContain('h-full');
    expect(trigger.className).toContain('w-full');
    trigger.getBoundingClientRect = jest.fn(() => ({
      x: 24,
      y: 220,
      width: 40,
      height: 40,
      top: 220,
      right: 64,
      bottom: 260,
      left: 24,
      toJSON: () => undefined,
    }));

    fireEvent.click(trigger);

    expect(trigger).toHaveTextContent('');
    expect(screen.getByRole('dialog', { name: 'Account filter' })).toHaveStyle({
      bottom: '688px',
      left: '24px',
    });
  });
});
