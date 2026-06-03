import { buildSyncAllRows } from '@/features/sync/utils/buildSyncAllRows';

describe('buildSyncAllRows', () => {
  it('initializes each bank as a pending sync row', () => {
    expect(
      buildSyncAllRows([
        {
          id: 'bank-1',
          name: 'Demo Bank',
          provider: 'plaid',
          connectionId: 'conn-1',
        },
        {
          id: 'bank-2',
          name: 'Bridge Bank',
          provider: 'simplefin',
          connectionId: null,
        },
      ])
    ).toEqual([
      {
        id: 'bank-1',
        provider: 'plaid',
        institutionName: 'Demo Bank',
        connectionId: 'conn-1',
        status: 'pending',
        detail: null,
        transactionCount: null,
        retryAfterSeconds: null,
      },
      {
        id: 'bank-2',
        provider: 'simplefin',
        institutionName: 'Bridge Bank',
        connectionId: null,
        status: 'pending',
        detail: null,
        transactionCount: null,
        retryAfterSeconds: null,
      },
    ]);
  });
});
