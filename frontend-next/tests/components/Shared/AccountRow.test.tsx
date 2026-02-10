import { render, screen, cleanup } from '@testing-library/react';
import { AccountRow } from '@/components/AccountRow';

const mockCheckingAccount = {
  id: 'acc-1',
  name: 'Chase Checking',
  mask: '1234',
  type: 'checking' as const,
  balance: 1500.5,
  transactions: 25,
};

const mockSavingsAccount = {
  id: 'acc-2',
  name: 'Chase Savings',
  mask: '5678',
  type: 'savings' as const,
  balance: 5000,
  transactions: 10,
};

const mockCreditAccount = {
  id: 'acc-3',
  name: 'Chase Credit Card',
  mask: '9999',
  type: 'credit' as const,
  balance: -1200.75,
  transactions: 35,
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('AccountRow', () => {
  describe('when displaying account information', () => {
    it('shows account name and masked number', () => {
      render(<AccountRow account={mockCheckingAccount} />);

      expect(screen.getByText('Chase Checking')).toBeInTheDocument();
      expect(screen.getByText('••1234')).toBeInTheDocument();
    });

    it('displays account type with correct color coding', () => {
      const { container } = render(<AccountRow account={mockCheckingAccount} />);

      expect(screen.getByText('checking')).toBeInTheDocument();
      const typeDot = container.querySelector('span.inline-block.h-2\\.5');
      expect(typeDot).toBeInTheDocument();
    });

    it('formats positive balance in emerald color', () => {
      render(<AccountRow account={mockCheckingAccount} />);

      const balanceElement = screen.getByText('$1,500.50');
      expect(balanceElement).toHaveClass('dark:text-emerald-400');
    });

    it('formats credit account negative balance in red color', () => {
      render(<AccountRow account={mockCreditAccount} />);

      const balanceElement = screen.getByText('-$1,200.75');
      expect(balanceElement).toHaveClass('dark:text-red-400');
    });

    it('formats checking account negative balance in rose color', () => {
      const checkingWithNegativeBalance = {
        ...mockCheckingAccount,
        balance: -500.25,
      };

      render(<AccountRow account={checkingWithNegativeBalance} />);

      const balanceElement = screen.getByText('-$500.25');
      expect(balanceElement).toHaveClass('dark:text-rose-400');
    });

    it('shows transaction count', () => {
      render(<AccountRow account={mockCheckingAccount} />);

      expect(screen.getByText('25 items')).toBeInTheDocument();
    });
  });

  describe('when handling different account types', () => {
    it('displays savings account correctly', () => {
      render(<AccountRow account={mockSavingsAccount} />);

      expect(screen.getByText('Chase Savings')).toBeInTheDocument();
      expect(screen.getByText('••5678')).toBeInTheDocument();
      expect(screen.getByText('savings')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      expect(screen.getByText('10 items')).toBeInTheDocument();
    });

    it('displays credit account correctly', () => {
      render(<AccountRow account={mockCreditAccount} />);

      expect(screen.getByText('Chase Credit Card')).toBeInTheDocument();
      expect(screen.getByText('••9999')).toBeInTheDocument();
      expect(screen.getByText('credit')).toBeInTheDocument();
      expect(screen.getByText('-$1,200.75')).toBeInTheDocument();
      expect(screen.getByText('35 items')).toBeInTheDocument();
    });
  });

  describe('when handling missing data', () => {
    it('shows placeholder for undefined balance', () => {
      const accountWithoutBalance = {
        ...mockCheckingAccount,
        balance: undefined,
      };

      render(<AccountRow account={accountWithoutBalance} />);

      expect(screen.getByText('PLACEHOLDER')).toBeInTheDocument();
      const placeholderElement = screen.getByText('PLACEHOLDER');
      expect(placeholderElement).toHaveClass('text-slate-400');
    });

    it('shows zero transactions when undefined', () => {
      const accountWithoutTransactions = {
        ...mockCheckingAccount,
        transactions: undefined,
      };

      render(<AccountRow account={accountWithoutTransactions} />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
    });

    it('handles zero balance correctly', () => {
      const accountWithZeroBalance = {
        ...mockCheckingAccount,
        balance: 0,
      };

      render(<AccountRow account={accountWithZeroBalance} />);

      const balanceElement = screen.getByText('$0.00');
      expect(balanceElement).toHaveClass('dark:text-slate-600');
    });
  });

  describe('when rendering without individual controls', () => {
    it('does not show any sync or disconnect buttons', () => {
      render(<AccountRow account={mockCheckingAccount} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText(/sync/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/disconnect/i)).not.toBeInTheDocument();
    });
  });
});
