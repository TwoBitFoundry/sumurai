import {
  ACCOUNT_GROUP_ACCENT,
  ACCOUNT_GROUP_LABELS,
  accountTypeSortOrder,
  accountTypeToGroup,
  DIY_ACCOUNT_TYPE_OPTIONS,
  mapStoredAccountTypeToUiType,
} from '@/domain/accountCategories';

describe('accountCategories', () => {
  it('maps UI account types to dashboard group keys', () => {
    expect(accountTypeToGroup('cash')).toBe('cash');
    expect(accountTypeToGroup('credit')).toBe('credit');
    expect(accountTypeToGroup('loan')).toBe('loans');
    expect(accountTypeToGroup('investments')).toBe('investments');
  });

  it('maps stored account types to UI types used by bank cards', () => {
    expect(mapStoredAccountTypeToUiType('cash')).toBe('cash');
    expect(mapStoredAccountTypeToUiType('depository')).toBe('cash');
    expect(mapStoredAccountTypeToUiType('investments')).toBe('investments');
    expect(mapStoredAccountTypeToUiType('investment')).toBe('investments');
    expect(mapStoredAccountTypeToUiType('loans')).toBe('loan');
    expect(mapStoredAccountTypeToUiType('loan')).toBe('loan');
    expect(mapStoredAccountTypeToUiType('credit')).toBe('credit');
  });

  it('uses dashboard group keys for DIY account type values', () => {
    expect(DIY_ACCOUNT_TYPE_OPTIONS).toEqual([
      { label: 'Cash', value: 'depository' },
      { label: 'Investments', value: 'investment' },
      { label: 'Loans', value: 'loan' },
      { label: 'Credit', value: 'credit' },
    ]);
  });

  it('orders groups to match dashboard category sequence', () => {
    expect(accountTypeSortOrder.cash).toBeLessThan(accountTypeSortOrder.credit);
    expect(accountTypeSortOrder.credit).toBeLessThan(accountTypeSortOrder.investments);
    expect(accountTypeSortOrder.investments).toBeLessThan(accountTypeSortOrder.loan);
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
