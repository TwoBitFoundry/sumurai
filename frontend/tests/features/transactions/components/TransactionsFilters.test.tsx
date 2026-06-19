import { describe, expect, it, jest } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { HORIZONTAL_SCROLL_RAIL_STEP_PX } from '@/hooks/useHorizontalScrollRail';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

jest.mock('@/features/transactions/components/DeleteCustomCategoryConfirm', () => ({
  __esModule: true,
  default: ({ open, category }: { open: boolean; category: { display_name: string } | null }) =>
    open ? <div data-testid="delete-custom-category-confirm">{category?.display_name}</div> : null,
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    accentIndexByName: new Map([
      ['food_and_drink', 0],
      ['entertainment', 1],
      ['Coffee', 2],
    ]),
    filterCategories: ['food_and_drink', 'entertainment', 'Coffee'],
    system: [],
    custom: [],
    all: [],
    isLoading: false,
    error: null,
  }),
}));

const filterProps = {
  search: '',
  onSearch: jest.fn(),
  categories: ['food_and_drink', 'entertainment'],
  selectedCategory: null,
  onSelectCategory: jest.fn(),
  showSearch: false,
};

describe('TransactionsFilters', () => {
  beforeEach(() => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it('renders category filters as filter chip buttons', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();

    render(<TransactionsFilters {...filterProps} onSelectCategory={onSelectCategory} />);

    const foodButton = screen.getByRole('button', { name: 'Food & Drink' });
    expect(foodButton.className).toContain('rounded-full');
    expect(foodButton.className).toContain('cursor-pointer');
    expect(foodButton.className).toContain('py-0');
    expect(foodButton.className).toContain('text-sky-500');
    expect(foodButton.className).toContain('!bg-sky-500/20');
    expect(foodButton.className).toContain('!border-sky-200/60');
    expect(foodButton.className).not.toContain('linear-gradient');
    expect(foodButton.className).not.toContain('text-slate-800');
    expect(foodButton.className).not.toContain('h-11');
    expect(foodButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(foodButton);
    expect(onSelectCategory).toHaveBeenCalledWith('food_and_drink');
  });

  it('uses touch-height filter chips on mobile', () => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });

    render(<TransactionsFilters {...filterProps} />);

    const foodButton = screen.getByRole('button', { name: 'Food & Drink' });
    expect(foodButton.className).toContain('py-0');
    expect(foodButton.className).not.toContain('h-11');
  });

  it('marks the active category filter as pressed', () => {
    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['entertainment']}
        selectedCategory="entertainment"
        onSelectCategory={jest.fn()}
        showSearch={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Entertainment' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const entertainmentButton = screen.getByRole('button', { name: 'Entertainment' });
    expect(entertainmentButton.className).toContain('ring-emerald-400');
    expect(entertainmentButton.className).toContain('!border-emerald-500');
    expect(entertainmentButton.className).toContain('!bg-emerald-500/20');
    expect(entertainmentButton.className).not.toContain('!bg-emerald-500/50');
  });

  it('centers inline category filters when they fit within the container', () => {
    const { container } = render(
      <TransactionsFilters {...filterProps} layout="inline" showFilterLabel={false} />
    );

    const scrollContainer = container.querySelector('[data-no-swipe]');
    expect(scrollContainer?.className).toContain('justify-center');
  });

  it('keeps inline category filters in a bounded scroll container', () => {
    const { container } = render(
      <TransactionsFilters
        {...filterProps}
        categories={['food_and_drink', 'entertainment', 'Bills', 'Subscriptions', 'Travel']}
        layout="inline"
        showFilterLabel={false}
      />
    );

    const filters = screen.getByTestId('transactions-filters');
    const scrollContainer = container.querySelector('[data-no-swipe]');
    const billsButton = screen.getByRole('button', { name: 'Bills' });

    expect(filters.className).toContain('min-w-0');
    expect(scrollContainer?.className).toContain('overflow-x-auto');
    expect(scrollContainer?.className).toContain('w-full');
    expect(scrollContainer?.className).toContain('max-w-full');
    expect(scrollContainer?.className).toContain('py-1.5');
    expect(billsButton.className).toContain('backdrop-blur-md');
    expect(billsButton.className).toContain('backdrop-saturate-[150%]');
    expect(billsButton.className).not.toContain('linear-gradient');
  });

  it('uses category styling for selected inline category filters', () => {
    render(
      <TransactionsFilters
        {...filterProps}
        categories={['entertainment']}
        selectedCategory="entertainment"
        layout="inline"
        showFilterLabel={false}
      />
    );

    const entertainmentButton = screen.getByRole('button', { name: 'Entertainment' });
    expect(entertainmentButton.className).toContain('text-emerald-500');
    expect(entertainmentButton.className).toContain('ring-emerald-400');
    expect(entertainmentButton.className).toContain('!border-emerald-500');
    expect(entertainmentButton.className).not.toContain('linear-gradient');
  });

  it('does not apply scroll fade masks to inline contextual category filters', () => {
    const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth'
    );
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth'
    );

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 400;
      },
    });

    const { container } = render(
      <TransactionsFilters
        {...filterProps}
        categories={['food_and_drink', 'entertainment', 'Bills', 'Subscriptions', 'Travel']}
        layout="inline"
        showFilterLabel={false}
      />
    );

    const maskViewport = container.querySelector('[data-no-swipe]')?.parentElement;
    expect(maskViewport?.style.maskImage || '').toBe('');
    expect(maskViewport?.style.webkitMaskImage || '').toBe('');
    expect(maskViewport?.className).not.toContain('[mask-mode:alpha]');
    expect(screen.queryByTestId('contextual-filter-fade-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contextual-filter-fade-right')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll categories right' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll categories right' }).className).toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]'
    );

    if (scrollWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidthDescriptor);
    }
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
    }
  });

  it('shows scroll arrows when category filters overflow and scrolls on tap', async () => {
    const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth'
    );
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth'
    );
    const scrollBy = jest.spyOn(HTMLElement.prototype, 'scrollBy');

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 400;
      },
    });

    const user = userEvent.setup();
    render(
      <TransactionsFilters
        {...filterProps}
        categories={['food_and_drink', 'entertainment', 'Bills', 'Subscriptions', 'Travel']}
        layout="inline"
        showFilterLabel={false}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Scroll categories left' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll categories right' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll categories right' }).className).toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]'
    );

    await user.click(screen.getByRole('button', { name: 'Scroll categories right' }));

    expect(scrollBy).toHaveBeenCalledWith({
      left: HORIZONTAL_SCROLL_RAIL_STEP_PX,
      behavior: 'smooth',
    });

    scrollBy.mockRestore();
    if (scrollWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidthDescriptor);
    }
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
    }
  });

  it('shows a delete affordance for custom categories without toggling the filter', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();

    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['food_and_drink', 'Coffee']}
        customCategories={[{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }]}
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        showSearch={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete Coffee' }));

    expect(onSelectCategory).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-custom-category-confirm')).toHaveTextContent('Coffee');
  });
});
