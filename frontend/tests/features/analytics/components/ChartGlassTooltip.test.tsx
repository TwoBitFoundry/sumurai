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
    expect(tooltip.className).toContain('bg-transparent');
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
});
