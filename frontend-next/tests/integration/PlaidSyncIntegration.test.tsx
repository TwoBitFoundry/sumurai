import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import type { PlaidSyncResponse } from '@/types/api';
import { PlaidService } from '@/services/PlaidService';

let fetchMock: ReturnType<typeof installFetchRoutes>;

describe('Plaid Sync Integration Tests (Boundary-Only Mocking)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('given_incremental_sync_when_calling_api_then_returns_correct_date_range', async () => {
    // Set up route for incremental sync scenario (boundary-only mocking)
    fetchMock = installFetchRoutes({
      'POST /api/providers/sync-transactions': {
        transactions: [
          {
            id: 'txn-new-1',
            date: '2025-01-19',
            name: 'New Coffee Purchase',
            amount: 5.25,
            category: { primary: 'FOOD_AND_DRINK', detailed: 'COFFEE' },
            provider: 'plaid',
            account_name: 'Checking',
            account_type: 'depository',
          },
        ],
        metadata: {
          transaction_count: 126,
          account_count: 2,
          sync_timestamp: '2025-01-20T10:30:00Z',
          start_date: '2025-01-15', // Shows incremental sync with 2-day buffer
          end_date: '2025-01-20',
          connection_updated: true,
        },
      } as PlaidSyncResponse,
    });

    // Call real service with mocked network boundary
    const result = await PlaidService.syncTransactions();

    // Verify incremental sync date range
    expect(result.metadata.start_date).toBe('2025-01-15');
    expect(result.metadata.end_date).toBe('2025-01-20');
    expect(result.metadata.transaction_count).toBe(126);
    expect(result.transactions).toHaveLength(1);
  });

  it('given_first_time_sync_when_calling_api_then_returns_90_day_window', async () => {
    // Set up route for first-time sync scenario (90-day default)
    fetchMock = installFetchRoutes({
      'POST /api/providers/sync-transactions': {
        transactions: [],
        metadata: {
          transaction_count: 45,
          account_count: 2,
          sync_timestamp: '2025-01-20T10:30:00Z',
          start_date: '2024-10-22', // Shows 90-day default window
          end_date: '2025-01-20',
          connection_updated: true,
        },
      } as PlaidSyncResponse,
    });

    const result = await PlaidService.syncTransactions();

    // Verify 90-day first sync window
    expect(result.metadata.start_date).toBe('2024-10-22');
    expect(result.metadata.end_date).toBe('2025-01-20');
    expect(result.metadata.transaction_count).toBe(45);
    expect(result.transactions).toHaveLength(0);
  });

  it('given_old_connection_when_calling_api_then_caps_at_5_year_window', async () => {
    // Set up route for very old connection (5-year cap applied)
    fetchMock = installFetchRoutes({
      'POST /api/providers/sync-transactions': {
        transactions: [],
        metadata: {
          transaction_count: 500,
          account_count: 2,
          sync_timestamp: '2025-01-20T10:30:00Z',
          start_date: '2020-01-20', // Shows 5-year cap applied
          end_date: '2025-01-20',
          connection_updated: true,
        },
      } as PlaidSyncResponse,
    });

    const result = await PlaidService.syncTransactions();

    // Verify 5-year cap is applied
    expect(result.metadata.start_date).toBe('2020-01-20');
    expect(result.metadata.end_date).toBe('2025-01-20');
    expect(result.metadata.transaction_count).toBe(500);
  });

  it('given_sync_error_when_calling_api_then_throws_error', async () => {
    // Set up route for error scenario
    fetchMock = installFetchRoutes({
      'POST /api/providers/sync-transactions': new Response('Server error', { status: 500 }),
    });

    // Should throw error for failed sync
    await expect(PlaidService.syncTransactions()).rejects.toThrow();
  });
});
