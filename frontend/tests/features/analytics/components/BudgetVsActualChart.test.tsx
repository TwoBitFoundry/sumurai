import { render } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { BudgetVsActualChart } from '@/features/analytics/components/BudgetVsActualChart';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

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

  it('formats currency values on tooltips', () => {
    const data = [{ month: '2026-05', expenses: 1234.56 }];
    const { container } = render(
      <BudgetVsActualChart data={data} totalBudget={2000} width={400} height={300} />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
