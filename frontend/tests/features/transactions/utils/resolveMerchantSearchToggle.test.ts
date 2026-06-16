import { resolveMerchantSearchToggle } from '@/features/transactions/utils/resolveMerchantSearchToggle';

describe('resolveMerchantSearchToggle', () => {
  it('sets the merchant when search is empty', () => {
    expect(resolveMerchantSearchToggle('', 'Transfer')).toBe('Transfer');
  });

  it('sets the merchant when search differs', () => {
    expect(resolveMerchantSearchToggle('Target', 'Transfer')).toBe('Transfer');
  });

  it('clears search when the same merchant is clicked again', () => {
    expect(resolveMerchantSearchToggle('Transfer', 'Transfer')).toBe('');
  });

  it('clears search when the merchant matches case-insensitively', () => {
    expect(resolveMerchantSearchToggle('transfer', 'Transfer')).toBe('');
  });
});
