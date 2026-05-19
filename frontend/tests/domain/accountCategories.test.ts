import {
  ACCOUNT_GROUP_ACCENT,
  ACCOUNT_GROUP_LABELS,
  accountTypeSortOrder,
  accountTypeToGroup,
} from '@/domain/accountCategories';

describe('accountCategories', () => {
  it('maps account types to dashboard group keys', () => {
    expect(accountTypeToGroup('checking')).toBe('cash');
    expect(accountTypeToGroup('savings')).toBe('cash');
    expect(accountTypeToGroup('credit')).toBe('credit');
    expect(accountTypeToGroup('loan')).toBe('loans');
    expect(accountTypeToGroup('other')).toBe('investments');
  });

  it('orders groups to match dashboard category sequence', () => {
    expect(accountTypeSortOrder.checking).toBeLessThan(accountTypeSortOrder.credit);
    expect(accountTypeSortOrder.credit).toBeLessThan(accountTypeSortOrder.other);
    expect(accountTypeSortOrder.other).toBeLessThan(accountTypeSortOrder.loan);
  });

  it('uses dashboard category labels', () => {
    expect(ACCOUNT_GROUP_LABELS).toEqual({
      cash: 'Cash',
      credit: 'Credit',
      investments: 'Investments',
      loans: 'Loans',
    });
  });

  it('uses dashboard hero accents for category icons', () => {
    expect(ACCOUNT_GROUP_ACCENT).toEqual({
      cash: 'emerald',
      credit: 'rose',
      investments: 'sky',
      loans: 'amber',
    });
  });
});
