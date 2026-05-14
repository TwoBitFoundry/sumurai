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

  it('renders an icon-only trigger and opens the popover above the trigger', () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    render(
      <div data-bottom-bar-controls>
        <HeaderAccountFilter triggerStyle="icon-only" />
      </div>
    );

    const bottomBar = document.querySelector('[data-bottom-bar-controls]');
    if (!bottomBar) {
      throw new Error('Missing bottom bar wrapper');
    }
    bottomBar.getBoundingClientRect = jest.fn(() => ({
      x: 120,
      y: 220,
      width: 320,
      height: 44,
      top: 220,
      right: 440,
      bottom: 264,
      left: 120,
      toJSON: () => undefined,
    }));

    const trigger = screen.getByRole('button', { name: 'Filter accounts' });
    trigger.getBoundingClientRect = jest.fn(() => ({
      x: 120,
      y: 220,
      width: 40,
      height: 40,
      top: 220,
      right: 160,
      bottom: 260,
      left: 120,
      toJSON: () => undefined,
    }));

    fireEvent.click(trigger);

    expect(trigger).toHaveTextContent('');
    expect(screen.getByRole('dialog', { name: 'Account filter' })).toHaveStyle({
      bottom: '688px',
      left: '120px',
      width: '320px',
    });
  });
});
