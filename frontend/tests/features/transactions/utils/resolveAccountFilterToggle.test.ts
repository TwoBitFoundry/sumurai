import { resolveAccountFilterToggle } from '@/features/transactions/utils/resolveAccountFilterToggle';

describe('resolveAccountFilterToggle', () => {
  const allAccountIds = ['account-1', 'account-2', 'account-3'];

  it('selects only the clicked account when multiple are selected', () => {
    expect(resolveAccountFilterToggle('account-2', allAccountIds, allAccountIds)).toEqual([
      'account-2',
    ]);
  });

  it('selects only the clicked account from the all-selected state', () => {
    expect(resolveAccountFilterToggle('account-1', allAccountIds, allAccountIds)).toEqual([
      'account-1',
    ]);
  });

  it('restores all accounts when the same sole selection is clicked again', () => {
    expect(resolveAccountFilterToggle('account-1', ['account-1'], allAccountIds)).toEqual(
      allAccountIds
    );
  });

  it('switches to a different account when another account is already sole-selected', () => {
    expect(resolveAccountFilterToggle('account-2', ['account-1'], allAccountIds)).toEqual([
      'account-2',
    ]);
  });
});
