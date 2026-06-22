import {
  createMerchantScrollRestoreState,
  prepareMerchantSearchScrollRestore,
} from '@/features/transactions/utils/merchantScrollRestore';

describe('prepareMerchantSearchScrollRestore', () => {
  it('saves scroll offset when applying a merchant filter from the list', () => {
    const result = prepareMerchantSearchScrollRestore(
      createMerchantScrollRestoreState(),
      '',
      'Transfer',
      480
    );

    expect(result.nextSearch).toBe('Transfer');
    expect(result.state).toEqual({
      savedOffset: 480,
      shouldRestoreOnNextFilterKey: false,
    });
  });

  it('marks the saved offset for restore when clearing the same merchant filter', () => {
    const result = prepareMerchantSearchScrollRestore(
      {
        savedOffset: 480,
        shouldRestoreOnNextFilterKey: false,
      },
      'Transfer',
      'Transfer',
      0
    );

    expect(result.nextSearch).toBe('');
    expect(result.state).toEqual({
      savedOffset: 480,
      shouldRestoreOnNextFilterKey: true,
    });
  });

  it('discards saved scroll state when switching to a different merchant', () => {
    const result = prepareMerchantSearchScrollRestore(
      {
        savedOffset: 480,
        shouldRestoreOnNextFilterKey: false,
      },
      'Target',
      'Transfer',
      120
    );

    expect(result.nextSearch).toBe('Transfer');
    expect(result.state).toEqual({
      savedOffset: 120,
      shouldRestoreOnNextFilterKey: false,
    });
  });
});
