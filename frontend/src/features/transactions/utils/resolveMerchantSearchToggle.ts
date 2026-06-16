export function resolveMerchantSearchToggle(currentSearch: string, merchant: string): string {
  return currentSearch.trim().toLowerCase() === merchant.trim().toLowerCase() ? '' : merchant;
}
