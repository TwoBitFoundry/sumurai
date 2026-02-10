import { BudgetService } from '@/services/BudgetService';
import { ApiClient } from '@/services/ApiClient';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('BudgetService.getBudgets — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given backend returns budgets; When getBudgets; Then maps amount string to number', async () => {
    jest.mocked(ApiClient.get).mockResolvedValueOnce([
      { id: 'b1', category: 'Food', amount: '100.50' },
      { id: 'b2', category: 'Rent', amount: '1200' },
    ] as any);

    const budgets = await BudgetService.getBudgets();

    expect(ApiClient.get).toHaveBeenCalledWith('/budgets');
    expect(budgets).toEqual([
      { id: 'b1', category: 'Food', amount: 100.5 },
      { id: 'b2', category: 'Rent', amount: 1200 },
    ]);
  });

  it('Given 404/network error; When getBudgets; Then propagates error (no legacy fallback)', async () => {
    const err = new Error('Network');
    jest.mocked(ApiClient.get).mockRejectedValueOnce(err);

    await expect(BudgetService.getBudgets()).rejects.toBe(err);
    // Should not try legacy endpoints
    expect(ApiClient.get).toHaveBeenCalledTimes(1);
  });
});

describe('BudgetService.createBudget — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given valid payload; When createBudget({ category, amount }); Then POST /api/budgets with amount as string (no month), returns mapped budget with numeric amount', async () => {
    jest
      .mocked(ApiClient.post)
      .mockResolvedValueOnce({ id: 'b3', category: 'Groceries', amount: '150.25' } as any);

    const created = await BudgetService.createBudget({ category: 'Groceries', amount: 150.25 });

    expect(ApiClient.post).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = jest.mocked(ApiClient.post).mock.calls[0];
    expect(endpoint).toBe('/budgets');
    // Should not include month
    expect(payload).toEqual({ category: 'Groceries', amount: '150.25' });

    // Returned amount mapped to number
    expect(created).toEqual({ id: 'b3', category: 'Groceries', amount: 150.25 });
  });
});

describe('BudgetService.updateBudget — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given valid update; When updateBudget(id, { amount }); Then PUT /api/budgets/{id} with amount as string and maps response amount to number', async () => {
    jest
      .mocked(ApiClient.put)
      .mockResolvedValueOnce({ id: 'b1', category: 'Food', amount: '275.75' } as any);

    const updated = await BudgetService.updateBudget('b1', { amount: 275.75 });

    expect(ApiClient.put).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = jest.mocked(ApiClient.put).mock.calls[0];
    expect(endpoint).toBe('/budgets/b1');
    expect(payload).toEqual({ amount: '275.75' });

    expect(updated).toEqual({ id: 'b1', category: 'Food', amount: 275.75 });
  });
});

describe('BudgetService.deleteBudget — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given id; When deleteBudget(id); Then DELETE /api/budgets/{id}', async () => {
    jest.mocked(ApiClient.delete).mockResolvedValueOnce(undefined as any);

    await BudgetService.deleteBudget('b123');

    expect(ApiClient.delete).toHaveBeenCalledTimes(1);
    expect(jest.mocked(ApiClient.delete).mock.calls[0][0]).toBe('/budgets/b123');
  });
});
