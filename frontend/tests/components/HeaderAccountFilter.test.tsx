import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';
import { HeaderAccountFilter } from '@/components/HeaderAccountFilter';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';

describe('HeaderAccountFilter', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    const providerStatus = createProviderStatus({
      connections: [
        createProviderConnection({
          is_connected: true,
          connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
          account_count: 3,
        }),
      ],
    });

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Chase Checking',
          account_type: 'depository',
          balance_ledger: 1250.5,
          balance_available: 1200,
          balance_current: 1250.5,
          mask: '0000',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
          provider: 'plaid',
        },
        {
          id: 'acc_2',
          name: 'Chase Savings',
          account_type: 'depository',
          balance_ledger: 5000.0,
          balance_available: 5000.0,
          balance_current: 5000.0,
          mask: '1111',
          plaid_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
          provider: 'plaid',
        },
        {
          id: 'acc_3',
          name: 'Wells Fargo Credit Card',
          account_type: 'credit',
          balance_ledger: -350.75,
          balance_available: -350.75,
          balance_current: -350.75,
          mask: '2222',
          plaid_connection_id: 'conn_2',
          institution_name: 'Second Platypus Bank',
          provider: 'plaid',
        },
      ],
      'GET /api/providers/status': providerStatus,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderComponent = () => {
    return render(
      <AccountFilterProvider>
        <HeaderAccountFilter />
      </AccountFilterProvider>
    );
  };

  describe('Given the component is rendered', () => {
    describe('When no custom selection is made', () => {
      it('Then it should render "All accounts" once accounts load', async () => {
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        expect(trigger).toBeInTheDocument();
      });
    });

    describe('When the trigger button is clicked', () => {
      it('Then the popover should open', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        expect(trigger).toBeInTheDocument();

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
      });

      it('Then the popover should close when clicked again', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      });
    });

    describe('When accounts are loaded', () => {
      it('Then it should display grouped checklists by bank', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await waitFor(() => {
          expect(screen.getByText('First Platypus Bank')).toBeInTheDocument();
          expect(screen.getByText('Second Platypus Bank')).toBeInTheDocument();
        });

        expect(screen.getByText('Chase Checking')).toBeInTheDocument();
        expect(screen.getByText('Chase Savings')).toBeInTheDocument();
        expect(screen.getByText('Wells Fargo Credit Card')).toBeInTheDocument();
      });

      it('Then clearing all bank selections updates the header state', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const firstBankToggle = screen.getByLabelText('First Platypus Bank');
        const secondBankToggle = screen.getByLabelText('Second Platypus Bank');

        expect(firstBankToggle).toBeChecked();
        expect(secondBankToggle).toBeChecked();

        await user.click(firstBankToggle);
        await user.click(secondBankToggle);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /no accounts selected/i })).toBeInTheDocument();
        });
      });

      it('Then individual account toggle should work correctly', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await waitFor(() => {
          expect(screen.getByText('First Platypus Bank')).toBeInTheDocument();
        });

        const chaseCheckingCheckbox = screen.getByLabelText('Chase Checking');
        expect(chaseCheckingCheckbox).toBeChecked();

        await user.click(chaseCheckingCheckbox);
        expect(chaseCheckingCheckbox).not.toBeChecked();

        await user.click(chaseCheckingCheckbox);
        expect(chaseCheckingCheckbox).toBeChecked();
      });
    });

    describe('When keyboard navigation is used', () => {
      it('Then it should support Tab, Enter, and Escape keys', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });

        trigger.focus();
        expect(trigger).toHaveFocus();

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(trigger).toHaveFocus();
      });

      it('Then it should have proper ARIA attributes', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', 'Account filter');
      });

      it('Then focus should return to trigger when popover closes', async () => {
        const user = userEvent.setup();
        renderComponent();

        const trigger = await screen.findByRole('button', { name: /all accounts/i });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        expect(trigger).toHaveFocus();
      });
    });
  });
});
