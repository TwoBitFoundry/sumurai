import { inferBankProvider } from '@/features/plaid/utils/inferBankProvider';

describe('inferBankProvider', () => {
  it('returns the provider mapped to the connection id', () => {
    const providerByConnectionId = new Map<string, 'plaid' | 'simplefin'>([
      ['plaid-conn', 'plaid'],
      ['simplefin-conn', 'simplefin'],
    ]);

    expect(inferBankProvider('simplefin-conn', providerByConnectionId, 'plaid')).toBe('simplefin');
  });

  it('falls back to the supplied default provider when the connection is unknown', () => {
    const providerByConnectionId = new Map<string, 'plaid' | 'simplefin'>([
      ['plaid-conn', 'plaid'],
    ]);

    expect(inferBankProvider('missing-conn', providerByConnectionId, 'simplefin')).toBe(
      'simplefin'
    );
  });
});
