import { inferBankProvider } from '@/features/plaid/utils/inferBankProvider';

describe('inferBankProvider', () => {
  it('returns the provider mapped to the connection id', () => {
    const providerByConnectionId = new Map<string, 'plaid' | 'teller' | 'simplefin'>([
      ['plaid-conn', 'plaid'],
      ['teller-conn', 'teller'],
    ]);

    expect(inferBankProvider('teller-conn', providerByConnectionId, 'plaid')).toBe('teller');
  });

  it('falls back to the supplied default provider when the connection is unknown', () => {
    const providerByConnectionId = new Map<string, 'plaid' | 'teller' | 'simplefin'>([
      ['plaid-conn', 'plaid'],
    ]);

    expect(inferBankProvider('missing-conn', providerByConnectionId, 'teller')).toBe('teller');
  });
});
