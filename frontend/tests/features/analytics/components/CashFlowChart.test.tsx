import { render } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { CashFlowChart } from '@/features/analytics/components/CashFlowChart';
import { netWorthLineChart } from '@/ui/recipes';
import { getThemeColors, status } from '@/ui/tokens';

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
    expect(container.innerHTML).toContain(`stop-color="${status.light.successIcon}"`);
    expect(container.innerHTML).toContain(`stop-color="${status.light.dangerIcon}"`);
  });

  it('renders a semantic net worth glow on the net line', () => {
    const data = [{ month: '2026-06', income: 5000, expenses: 3000, net: 2000 }];
    const { container } = render(<CashFlowChart data={data} width={400} height={300} />);
    const netWorthStroke = getThemeColors('light').semantic.netWorth;
    const html = container.innerHTML.toLowerCase();

    expect(html).toContain('net-worth-curve-glow');
    expect(html).toContain(`stddeviation="${netWorthLineChart.curveGlow.blurStdDeviation}"`);
    expect(html).toContain(`stroke="${netWorthStroke.toLowerCase()}"`);
    expect(html).toContain('name="net"');
  });
});
