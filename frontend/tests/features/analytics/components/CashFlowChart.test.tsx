import { render } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { CashFlowChart } from '@/features/analytics/components/CashFlowChart';
import { netWorthLineChart } from '@/ui/recipes';
import { finance, getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('CashFlowChart', () => {
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

  it('plots expenses below zero while keeping the expenses area present', () => {
    const data = [{ month: '2026-06', income: 5000, expenses: 3000, net: 2000 }];
    const { container } = render(<CashFlowChart data={data} width={400} height={300} />);

    expect(container.innerHTML).toContain('expensesGradient');
    expect(container.innerHTML).toContain('-$2k');
    expect(container.innerHTML).toContain(`stop-color="${finance.light.cash}"`);
    expect(container.innerHTML).toContain(`stop-color="${finance.light.credit}"`);
    expect(container.querySelectorAll('circle[r="5"]').length).toBe(3);
  });

  it('draws glow lines between income and expense markers', () => {
    const data = [
      { month: '2026-05', income: 4000, expenses: 2500, net: 1500 },
      { month: '2026-06', income: 5000, expenses: 3000, net: 2000 },
    ];
    const { container } = render(<CashFlowChart data={data} width={400} height={300} />);

    expect(container.querySelectorAll('.recharts-line-curve').length).toBeGreaterThanOrEqual(3);
    expect(container.innerHTML).toContain('income-curve-glow');
    expect(container.innerHTML).toContain('expense-curve-glow');
  });

  it('renders a semantic net worth glow on the net line', () => {
    const data = [{ month: '2026-06', income: 5000, expenses: 3000, net: 2000 }];
    const { container } = render(<CashFlowChart data={data} width={400} height={300} />);
    const netWorthStroke = netWorthLineChart.stroke.light;
    const html = container.innerHTML.toLowerCase();

    expect(html).toContain('net-worth-curve-glow');
    expect(html).toContain(`stddeviation="${netWorthLineChart.curveGlow.blurStdDeviation}"`);
    expect(html).toContain(`fill="${netWorthStroke.toLowerCase()}"`);
    expect(html).toContain('recharts-line-dots');
  });
});
