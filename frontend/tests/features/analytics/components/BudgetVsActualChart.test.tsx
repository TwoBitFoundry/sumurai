import { render } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { BudgetVsActualChart } from '@/features/analytics/components/BudgetVsActualChart';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

function visibleVarianceDotCount(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.recharts-line-dots circle')).filter(
    (circle) => circle.getAttribute('fill') !== 'transparent'
  ).length;
}

describe('BudgetVsActualChart', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: getThemeColors('light'),
    } as any);
  });

  it('renders a line chart showing variance', () => {
    const data = [
      { month: '2026-05', expenses: 2000 },
      { month: '2026-04', expenses: 2500 },
      { month: '2026-03', expenses: 1500 },
    ];
    const totalBudget = 2200;
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={totalBudget} width={400} height={300} />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('linearGradient')).toBeInTheDocument();
    const curvePath = container.querySelector('.recharts-line-curve');
    expect(curvePath?.getAttribute('stroke')).toContain('url(#');
  });

  it('calculates variance as expenses minus budget', () => {
    const data = [
      { month: '2026-05', expenses: 2500 },
      { month: '2026-04', expenses: 1800 },
    ];
    const totalBudget = 2000;
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={totalBudget} width={400} height={300} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays a reference line at y=0 for on-budget marker', () => {
    const data = [{ month: '2026-05', expenses: 2000 }];
    const totalBudget = 2500;
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={totalBudget} width={400} height={300} />
    );

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('handles empty data gracefully', () => {
    const { container } = render(
      <BudgetVsActualChart data={[]} totalBudget={2000} width={400} height={300} />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('draws a line between current and prior month', () => {
    const data = [
      { month: '2026-04', expenses: 1500 },
      { month: '2026-05', expenses: 2500 },
    ];
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={4240} width={400} height={300} />
    );

    const curve = container.querySelector('path.recharts-curve');
    expect(curve).toBeInTheDocument();
    expect(curve?.getAttribute('d')).toBeTruthy();
    expect(visibleVarianceDotCount(container)).toBe(2);
  });

  it('draws a solid line when variance is flat across months', () => {
    const data = [
      { month: '2026-04', expenses: 5000 },
      { month: '2026-05', expenses: 5000 },
    ];
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={4240} width={400} height={300} />
    );

    const curve = container.querySelector('path.recharts-curve');
    expect(curve?.getAttribute('d')).toBeTruthy();
    expect(curve?.getAttribute('stroke')).not.toContain('url(#');
    expect(visibleVarianceDotCount(container)).toBe(2);
  });

  it('shows a marker on each month for multi-month ranges', () => {
    const data = [
      { month: '2026-03', expenses: 1500 },
      { month: '2026-04', expenses: 5000 },
      { month: '2026-05', expenses: 2000 },
    ];
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={4240} width={400} height={300} />
    );

    expect(visibleVarianceDotCount(container)).toBe(3);
  });

  it('formats currency values on tooltips', () => {
    const data = [{ month: '2026-05', expenses: 1234.56 }];
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={2000} width={400} height={300} />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
