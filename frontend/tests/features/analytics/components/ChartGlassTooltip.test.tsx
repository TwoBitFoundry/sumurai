import { render, screen } from '@testing-library/react';
import {
  ChartGlassTooltip,
  ChartTooltipShell,
} from '@/features/analytics/components/ChartGlassTooltip';

describe('ChartGlassTooltip', () => {
  it('renders the tooltip shell with glass design token classes', () => {
    render(
      <ChartTooltipShell>
        <span>Net</span>
      </ChartTooltipShell>
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toContain('backdrop-blur-md');
    expect(tooltip.className).toContain('backdrop-saturate-[135%]');
    expect(tooltip.className).toContain('var(--color-brand-fog)');
    expect(tooltip.className).not.toContain('--color-surface-glass-panel');
  });

  it('renders formatted values inside the glass shell', () => {
    render(
      <ChartGlassTooltip
        active
        label="May 2026"
        payload={[{ name: 'Net', value: 1200, dataKey: 'net' }]}
        formatter={(value) => `$${value}`}
      />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('May 2026');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Net');
    expect(screen.getByRole('tooltip')).toHaveTextContent('$1200');
  });

  it('dedupes tooltip rows that share the same dataKey', () => {
    render(
      <ChartGlassTooltip
        active
        label="May 2026"
        payload={[
          { name: 'Income', value: 1200, dataKey: 'income' },
          { name: '', value: 1200, dataKey: 'income' },
          { name: 'Expenses', value: -400, dataKey: 'plottedExpenses' },
          { value: -400, dataKey: 'plottedExpenses' },
        ]}
      />
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Income');
    expect(tooltip).toHaveTextContent('Expenses');
    expect(tooltip.textContent?.match(/Income/g)?.length).toBe(1);
    expect(tooltip.textContent?.match(/Expenses/g)?.length).toBe(1);
  });
});
