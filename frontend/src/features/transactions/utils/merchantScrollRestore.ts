import { resolveMerchantSearchToggle } from './resolveMerchantSearchToggle';

export type MerchantScrollRestoreState = {
  savedOffset: number | null;
  shouldRestoreOnNextFilterKey: boolean;
};

export function createMerchantScrollRestoreState(): MerchantScrollRestoreState {
  return {
    savedOffset: null,
    shouldRestoreOnNextFilterKey: false,
  };
}

export function prepareMerchantSearchScrollRestore(
  state: MerchantScrollRestoreState,
  currentSearch: string,
  merchant: string,
  currentScrollOffset: number
): { nextSearch: string; state: MerchantScrollRestoreState } {
  const nextSearch = resolveMerchantSearchToggle(currentSearch, merchant);
  const isClearingSameMerchant =
    nextSearch === '' && currentSearch.trim().toLowerCase() === merchant.trim().toLowerCase();
  const isApplyingMerchant =
    nextSearch !== '' && currentSearch.trim().toLowerCase() !== merchant.trim().toLowerCase();

  if (isApplyingMerchant) {
    return {
      nextSearch,
      state: {
        savedOffset: currentScrollOffset,
        shouldRestoreOnNextFilterKey: false,
      },
    };
  }

  if (isClearingSameMerchant && state.savedOffset != null) {
    return {
      nextSearch,
      state: {
        savedOffset: state.savedOffset,
        shouldRestoreOnNextFilterKey: true,
      },
    };
  }

  return {
    nextSearch,
    state: createMerchantScrollRestoreState(),
  };
}

export type TransactionListScrollAccess = {
  getScrollOffset: () => number;
};
