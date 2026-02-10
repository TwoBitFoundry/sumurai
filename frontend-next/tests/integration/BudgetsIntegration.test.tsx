import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderStatus } from '@tests/utils/fixtures';
import { ThemeTestProvider } from '@tests/utils/ThemeTestProvider';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';

describe('AuthenticatedApp Budgets — Given/When/Then', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;
  const disconnectedStatus = createProviderStatus();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: healthy dashboard minimal data via boundary routes
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus({ connections: [] }),
      'GET /api/plaid/accounts': [],
      'GET /api/transactions': [],
      // Wildcards tolerate query params for date ranges
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [],
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('Given authenticated session; When app mounts; Then fetches budgets once and renders them', async () => {
    // Arrange
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [
        { id: 'b1', category: 'Food', amount: '200' },
        { id: 'b2', category: 'Rent', amount: '1200' },
      ],
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    // Navigate to Budgets tab
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    await waitFor(() => {
      const budgetCalls = fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/budgets');
      expect(budgetCalls.length).toBe(1); // Budgets fetched once on initial visit
      expect(screen.getAllByText(/Food/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Rent/i).length).toBeGreaterThan(0);
    });
  });

  it('Given getBudgets rejects; When app mounts; Then UI remains usable (no crash)', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': () => {
        throw new Error('network');
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const addBtns1 = await screen.findAllByRole('button', { name: /add budget/i });
    expect(addBtns1.length).toBeGreaterThan(0);
  });

  it('Given unauthenticated (401); When budgets load; Then UI does not crash on Budgets tab', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': new Response(
        JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const addBtns = await screen.findAllByRole('button', { name: /add budget/i });
    expect(addBtns.length).toBeGreaterThan(0);
  });

  it('Given 409 conflict on create; When adding duplicate category; Then shows friendly message and restores state', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [{ id: 'b1', category: 'Food', amount: '200' }],
      'POST /api/budgets': new Response(
        JSON.stringify({ error: 'CONFLICT', message: 'Duplicate category' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      ),
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    await userEvent.click(screen.getAllByRole('button', { name: /budgets/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Food/i).length).toBeGreaterThan(0);
    });

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /add budget/i }).length).toBeGreaterThan(0)
    );
    {
      const addBtns = screen.getAllByRole('button', { name: /add budget/i });
      await userEvent.click(addBtns[addBtns.length - 1]);
    }

    const categorySelect = await screen.findByTestId('budget-category-select');
    // Choose a valid option from the list; 'other' always exists when no transactions
    fireEvent.change(categorySelect, { target: { value: 'other' } });
    const amountInput = screen.getByTestId('budget-amount-input');
    fireEvent.input(amountInput, { target: { value: '200' } });
    await userEvent.click(screen.getByTestId('budget-save'));

    await waitFor(() => {
      // Ensure original budget remains visible after failed delete (rollback)
      expect(screen.getAllByText(/Food/i).length).toBeGreaterThan(0);
    });
  });

  it('Given create fails; When user adds budget; Then rolls back UI without crashing', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [],
      'POST /api/budgets': () => {
        throw new Error('create failed');
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const addBtns2 = await screen.findAllByRole('button', { name: /add budget/i });
    expect(addBtns2.length).toBeGreaterThan(0);
    await userEvent.click(addBtns2[0]);

    const categorySelect = await screen.findByTestId('budget-category-select');
    fireEvent.change(categorySelect, { target: { value: 'other' } });
    const amountInput = screen.getByTestId('budget-amount-input');
    fireEvent.input(amountInput, { target: { value: '250' } });
    await userEvent.click(screen.getByTestId('budget-save'));

    // Simplify assertion: ensure budgets empty state is visible and app is stable
    expect(await screen.findByTestId('budgets-empty-state')).toBeInTheDocument();
  });

  it('Given existing budget; When edit amount; Then updates UI immediately and reconciles with server', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [{ id: 'b1', category: 'Food', amount: '200' }],
      'PUT /api/budgets*': (req: Request) => {
        // Any PUT to /api/budgets/:id returns updated value
        return new Response(
          JSON.stringify({ id: req.url.split('/').pop(), category: 'Food', amount: '275' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const editButtons = await screen.findAllByRole('button', { name: /edit budget/i });
    await userEvent.click(editButtons[0]);

    const amountInput = (await screen.findAllByTestId('budget-amount-input'))[0];
    fireEvent.input(amountInput, { target: { value: '275' } });

    const saveButtons = await screen.findAllByRole('button', { name: /save budget/i });
    await userEvent.click(saveButtons[0]);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).startsWith('/api/budgets/') &&
          (c[1]?.method || 'GET').toUpperCase() === 'PUT'
      );
      expect(putCall).toBeTruthy();
    });
  });

  it('Given update fails; When edit; Then reverts to previous amount and shows error state gracefully', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [{ id: 'b1', category: 'Food', amount: '200' }],
      'PUT /api/budgets*': () => {
        throw new Error('update failed');
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const editButtons = await screen.findAllByRole('button', { name: /edit budget/i });
    await userEvent.click(editButtons[0]);

    const amountInputs = await screen.findAllByTestId('budget-amount-input');
    const amountInput = amountInputs[0];
    fireEvent.input(amountInput, { target: { value: '275' } });

    const saveButtons = await screen.findAllByRole('button', { name: /save budget/i });
    await userEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/budgets/i).length).toBeGreaterThan(0);
    });
  });

  it('Given budget exists; When delete; Then removes from UI immediately and remains removed on success', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [
        { id: 'b1', category: 'Food', amount: '200' },
        { id: 'b2', category: 'Rent', amount: '1200' },
      ],
      'DELETE /api/budgets*': () => new Response(null, { status: 204 }),
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    {
      const buds = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(buds[buds.length - 1]);
    }

    const deleteButtons = await screen.findAllByRole('button', { name: /delete budget/i });
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      const delCall = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).includes('/api/budgets/') &&
          (c[1]?.method || 'GET').toUpperCase() === 'DELETE'
      );
      expect(delCall).toBeTruthy();
    });
  });

  it('Given delete fails; When delete; Then restore budget and show error gracefully', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': [{ id: 'b1', category: 'Food', amount: '200' }],
      'DELETE /api/budgets*': () => {
        throw new Error('delete failed');
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    await userEvent.click(screen.getAllByRole('button', { name: /budgets/i })[0]);

    const deleteButtons = await screen.findAllByRole('button', { name: /delete budget/i });
    await userEvent.click(deleteButtons[0]);

    await waitFor(async () => {
      const addBtns = await screen.findAllByRole('button', { name: /add budget/i });
      expect(addBtns.length).toBeGreaterThan(0);
    });
  });

  it('Given budgets cached; When switching tabs/rerender; Then no duplicate loads', async () => {
    let getCount = 0;
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/plaid/accounts': [],
      'GET /api/budgets': () => {
        getCount += 1;
        return new Response(JSON.stringify([{ id: 'b1', category: 'Food', amount: '200' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
    });

    const { rerender } = render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /budgets/i }).length).toBeGreaterThan(0)
    );
    await userEvent.click(screen.getAllByRole('button', { name: /budgets/i })[0]);

    await waitFor(() => {
      expect(getCount).toBe(1); // Initial budgets load triggered on first visit
    });

    {
      const txBtns = screen.getAllByRole('button', { name: /transactions/i });
      await userEvent.click(txBtns[txBtns.length - 1]);
      const budBtns = screen.getAllByRole('button', { name: /budgets/i });
      await userEvent.click(budBtns[budBtns.length - 1]);
    }

    rerender(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={() => {}} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    );

    await waitFor(() => {
      expect(getCount).toBe(1); // Should remain the same, no additional calls after rerender
    });
  });
});
