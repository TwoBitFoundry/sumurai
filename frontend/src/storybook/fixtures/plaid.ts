import type { BankConnectionViewModel } from '@/features/plaid/components/ConnectionsList';

export const sampleBankConnections: BankConnectionViewModel[] = [
  {
    id: 'story-bank-1',
    name: 'Story Federal Credit Union',
    short: 'SF',
    status: 'connected',
    lastSync: '2026-05-01T12:00:00.000Z',
    provider: 'plaid',
    connectionId: 'story-connection-1',
    accounts: [
      {
        id: 'story-plaid-acct-1',
        name: 'Premium Rewards Checking With Optional Long Label',
        mask: '4821',
        type: 'checking',
        balance: 2450.12,
        transactions: 42,
      },
      {
        id: 'story-plaid-acct-2',
        name: 'High Yield Savings',
        mask: '1199',
        type: 'savings',
        balance: 12840.55,
        transactions: 6,
      },
    ],
  },
  {
    id: 'story-bank-2',
    name: 'Metro Digital Bank',
    short: 'MD',
    status: 'needs_reauth',
    lastSync: '2026-04-18T09:30:00.000Z',
    provider: 'plaid',
    connectionId: 'story-connection-2',
    accounts: [
      {
        id: 'story-plaid-acct-3',
        name: 'Rewards Visa Signature Preferred',
        mask: '7712',
        type: 'credit',
        balance: -842.4,
        transactions: 128,
      },
    ],
  },
];
