import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionInsightsPanel } from '@/features/transactions/components/TransactionInsightsPanel';
import type { ContextualInsightsResponse } from '@/types/api';

function makeInsights(
  overrides: Partial<ContextualInsightsResponse> = {}
): ContextualInsightsResponse {
  return {
    state: 'a',
    card1: {
      value: 1200,
      format: 'currency',
      secondary: 10,
      comparison: null,
      share: null,
      label: null,
    },
    card2: {
      value: 45.5,
      format: 'currency',
      secondary: null,
      comparison: null,
      share: null,
      label: null,
    },
    card3: null,
    ...overrides,
  };
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('TransactionInsightsPanel', () => {
  beforeEach(() => {
    setViewportWidth(1280);
  });

  it('renders the shell with the correct state label for state A', () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    expect(screen.getByTestId('transaction-insights-shell')).toBeInTheDocument();
    expect(screen.getByText('All transactions')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-insights-shell').className).toContain(
      'border-emerald-300'
    );
  });

  it('shows Loading… indicator when isLoading is true', () => {
    render(<TransactionInsightsPanel insights={null} isLoading={true} resetKey="k1" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not show Loading… when isLoading is false', () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('renders Card 1 title Volume and Card 2 title Typical for state A', () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('Typical')).toBeInTheDocument();
  });

  it('renders insight currency as signed outflows with expense styling', () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    const volumeAmount = screen.getByText('-$1,200.00');
    const typicalAmount = screen.getByText('-$45.50');
    expect(volumeAmount.className).toContain('text-red-600');
    expect(typicalAmount.className).toContain('text-red-600');
  });

  it('renders zero volume as unsigned $0.00 with muted styling', () => {
    const insights = makeInsights({
      card1: {
        value: 0,
        format: 'currency',
        secondary: 0,
        comparison: null,
        share: null,
        label: null,
      },
      card2: {
        value: 0,
        format: 'currency',
        secondary: null,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    const zeroAmounts = screen.getAllByText('$0.00');
    expect(zeroAmounts).toHaveLength(2);
    for (const amount of zeroAmounts) {
      expect(amount.className).toContain('text-slate-600');
      expect(amount.className).not.toContain('text-red-600');
      expect(amount.className).not.toContain('text-emerald-600');
    }
    expect(screen.queryByText('-$0.00')).not.toBeInTheDocument();
  });

  it('renders net income insight totals with income styling', () => {
    const insights = makeInsights({
      card1: {
        value: -500,
        format: 'currency',
        secondary: 2,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    const amount = screen.getByText('$500.00');
    expect(amount.className).toContain('text-emerald-600');
  });

  it('renders Card 1 title Category Total for state B', () => {
    render(
      <TransactionInsightsPanel
        insights={makeInsights({ state: 'b' })}
        isLoading={false}
        resetKey="k1"
      />
    );
    expect(screen.getByText('Category Total')).toBeInTheDocument();
    expect(screen.getByText('Category filter')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-insights-shell').className).toContain(
      'border-emerald-300'
    );
    expect(
      screen.getByTestId('insight-card-category-total').querySelector('svg')?.parentElement
    ).toHaveClass('text-emerald-500');
  });

  it('renders state C label Merchant view', () => {
    render(
      <TransactionInsightsPanel
        insights={makeInsights({ state: 'c' })}
        isLoading={false}
        resetKey="k1"
      />
    );
    expect(screen.getByText('Merchant view')).toBeInTheDocument();
    expect(screen.getByText('Lifetime Spend')).toBeInTheDocument();
  });

  it('renders Card 3 when provided in the response', () => {
    const insights = makeInsights({
      card3: {
        value: 3,
        format: 'count',
        secondary: 7,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
  });

  it('does not render Card 3 when card3 is null', () => {
    render(
      <TransactionInsightsPanel
        insights={makeInsights({ card3: null })}
        isLoading={false}
        resetKey="k1"
      />
    );
    expect(screen.queryByText('Breakdown')).not.toBeInTheDocument();
  });

  it('clicking a card flips it to show the question', async () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    const volumeBtn = screen.getByRole('button', { name: /volume/i });
    expect(volumeBtn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(volumeBtn);
    expect(volumeBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a flipped card returns it to the data face', async () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    const btn = screen.getByRole('button', { name: /volume/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('flipping one card does not flip the other', async () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    await userEvent.click(screen.getByRole('button', { name: /volume/i }));
    expect(screen.getByRole('button', { name: /typical/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('resets all flipped cards when resetKey changes', async () => {
    const { rerender } = render(
      <TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="key-a" />
    );
    await userEvent.click(screen.getByRole('button', { name: /volume/i }));
    expect(screen.getByRole('button', { name: /volume/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    rerender(
      <TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="key-b" />
    );
    expect(screen.getByRole('button', { name: /volume/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('lays out cards as flex-row on desktop', () => {
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    const shell = screen.getByTestId('transaction-insights-shell');
    const cardContainer = shell.querySelector('.flex.flex-row');
    expect(cardContainer).toBeTruthy();
  });

  it('lays out cards as a subgrid on mobile', () => {
    setViewportWidth(390);
    render(<TransactionInsightsPanel insights={makeInsights()} isLoading={false} resetKey="k1" />);
    const shell = screen.getByTestId('transaction-insights-shell');
    const cardContainer = shell.querySelector('.grid');
    expect(cardContainer?.className).toContain('grid-cols-[auto_1fr_auto_auto_auto]');
  });

  it('renders em-dash for null card2 value', () => {
    const insights = makeInsights({
      card2: {
        value: null,
        format: 'currency',
        secondary: null,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders percent for state E share-of-wallet card3', () => {
    const insights = makeInsights({
      state: 'e',
      card3: {
        value: 0.42,
        format: 'percent',
        secondary: 300,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('Share of Wallet')).toBeInTheDocument();
    expect(screen.getByText('42.0%')).toBeInTheDocument();
  });

  it('renders days ago for Triple recency card3', () => {
    const insights = makeInsights({
      state: 'triple',
      card3: {
        value: 14,
        format: 'days',
        secondary: null,
        comparison: null,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('Last Visit')).toBeInTheDocument();
    expect(screen.getByText('14 days')).toBeInTheDocument();
    expect(screen.getByText('ago')).toBeInTheDocument();
  });

  it('renders ratio with comparison for state B card3', () => {
    const insights = makeInsights({
      state: 'b',
      card3: {
        value: 1.8,
        format: 'ratio',
        secondary: null,
        comparison: 25.0,
        share: null,
        label: null,
      },
    });
    render(<TransactionInsightsPanel insights={insights} isLoading={false} resetKey="k1" />);
    expect(screen.getByText('1.8×')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
    const comparisonAmount = screen.getByText('-$25.00');
    expect(comparisonAmount.className).toContain('text-red-600');
    expect(comparisonAmount.className).not.toContain('font-caption');
  });

  it('renders the correct state label for Full filter (triple)', () => {
    render(
      <TransactionInsightsPanel
        insights={makeInsights({ state: 'triple' })}
        isLoading={false}
        resetKey="k1"
      />
    );
    expect(screen.getByText('Full filter')).toBeInTheDocument();
  });
});
