import { render, screen } from '@testing-library/react';
import InlineCategoryCell from '@/features/transactions/components/InlineCategoryCell';
import type { Transaction } from '@/types/api';
import { longestFormattedCategoryLabel, mobileCategoryChipWidthRem } from '@/utils/categories';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    all: ['GENERAL_MERCHANDISE', 'GOVERNMENT_AND_NON_PROFIT', 'MEDICAL'],
    accentIndexByName: new Map<string, number>(),
  }),
}));

jest.mock('@/features/transactions/hooks/useUpdateTransactionCategory', () => ({
  useUpdateTransactionCategory: () => ({
    updateTransactionCategory: jest.fn(),
  }),
}));

jest.mock('@/features/transactions/components/CategoryPicker', () => ({
  __esModule: true,
  default: () => null,
}));

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-02-26',
  name: 'Sephora',
  amount: 5.19,
  category: { primary: 'GENERAL_MERCHANDISE' },
};

describe('InlineCategoryCell', () => {
  it.each([
    ['dense mobile', true],
    ['desktop table', false],
  ])('uses shared inline label layout for %s rows', (_label, dense) => {
    const longestLabel = longestFormattedCategoryLabel();
    const expectedWidth = mobileCategoryChipWidthRem(longestLabel);

    const { container } = render(<InlineCategoryCell transaction={transaction} dense={dense} />);

    const slot = container.firstElementChild as HTMLElement;
    expect(slot.style.width).toBe(expectedWidth);

    const button = screen.getByRole('button', { name: /Edit category: Merchandise/i });
    expect(button.className).toContain('!justify-end');
    expect(button.className).toContain('text-amber-500');
    expect(button.className).not.toContain('rounded-full');
    expect(button.className).not.toContain('bg-[linear-gradient');
    expect(button.querySelector('span.flex-1')?.className).toContain('text-right');
    expect(button.querySelector('[aria-hidden="true"]')?.className).toContain('shrink-0');
    expect(button.className).not.toContain('h-11');
  });
});
