import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useEmblaCarousel from 'embla-carousel-react';
import React from 'react';
import { DashboardStatsCarousel } from '@/components/DashboardStatsCarousel';

const listeners = {
  select: new Set<(api: EmblaApi) => void>(),
  reInit: new Set<(api: EmblaApi) => void>(),
};

let selectedIndex = 0;

type EmblaApi = {
  canScrollPrev: () => boolean;
  canScrollNext: () => boolean;
  selectedScrollSnap: () => number;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  on: (event: 'select' | 'reInit', cb: (api: EmblaApi) => void) => void;
  off: (event: 'select' | 'reInit', cb: (api: EmblaApi) => void) => void;
  reInit: () => void;
  destroy: () => void;
};

const emblaApi: EmblaApi = {
  canScrollPrev: () => selectedIndex > 0,
  canScrollNext: () => selectedIndex < 1,
  selectedScrollSnap: () => selectedIndex,
  scrollPrev: () => {
    if (selectedIndex > 0) {
      selectedIndex -= 1;
      for (const listener of listeners.select) {
        listener(emblaApi);
      }
    }
  },
  scrollNext: () => {
    if (selectedIndex < 1) {
      selectedIndex += 1;
      for (const listener of listeners.select) {
        listener(emblaApi);
      }
    }
  },
  scrollTo: (index: number) => {
    selectedIndex = index;
    for (const listener of listeners.select) {
      listener(emblaApi);
    }
  },
  on: (event, cb) => {
    listeners[event].add(cb);
  },
  off: (event, cb) => {
    listeners[event].delete(cb);
  },
  reInit: () => {
    for (const listener of listeners.reInit) {
      listener(emblaApi);
    }
  },
  destroy: () => {
    listeners.select.clear();
    listeners.reInit.clear();
  },
};

jest.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: jest.fn(() => [jest.fn(), emblaApi]),
}));

jest.mock('@/components/BalancesOverview', () => ({
  __esModule: true,
  BalancesOverviewChart: () => React.createElement('div', { 'data-testid': 'balances-chart' }),
  default: () => React.createElement('div', { 'data-testid': 'balances-full' }),
}));

jest.mock('@/features/analytics/components/MoneyFlowSankeyChart', () => ({
  __esModule: true,
  MoneyFlowSankeyChart: () =>
    React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
  default: () => React.createElement('div', { 'data-testid': 'money-flow-sankey-chart' }),
}));

describe('DashboardStatsCarousel', () => {
  beforeEach(() => {
    selectedIndex = 0;
    listeners.select.clear();
    listeners.reInit.clear();
    jest.mocked(useEmblaCarousel).mockClear();
  });

  it('renders the insights card and navigates between money flow and balances', async () => {
    const user = userEvent.setup();
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Switch between wealth flow and balances by account. Investment and loan accounts are excluded from the flow view.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /show money flow/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /show balances now/i })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(
      screen.getByRole('button', { name: /show previous financial breakdown slide/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /show next financial breakdown slide/i })
    ).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /show next financial breakdown slide/i }));

    expect(screen.getByRole('tab', { name: /show balances now/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByRole('button', { name: /show next financial breakdown slide/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /show previous financial breakdown slide/i })
    ).not.toBeDisabled();
  });

  it('keeps the same card content on smaller viewports', () => {
    render(<DashboardStatsCarousel dateRange="current-month" />);

    expect(screen.getByTestId('dashboard-stats-carousel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /financial breakdown/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Switch between wealth flow and balances by account. Investment and loan accounts are excluded from the flow view.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show previous financial breakdown slide/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show next financial breakdown slide/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /show money flow/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /show balances now/i })).toBeInTheDocument();
    expect(screen.getByTestId('money-flow-sankey-chart')).toBeInTheDocument();
    expect(screen.getByTestId('balances-chart')).toBeInTheDocument();
  });

  it('only allows touch drag input', () => {
    render(<DashboardStatsCarousel dateRange="current-month" />);

    const options = jest.mocked(useEmblaCarousel).mock.calls[0][0];

    expect(options.watchDrag?.(emblaApi, { type: 'mousedown' } as any)).toBe(false);
    expect(options.watchDrag?.(emblaApi, { type: 'touchstart' } as any)).toBe(true);
  });
});
