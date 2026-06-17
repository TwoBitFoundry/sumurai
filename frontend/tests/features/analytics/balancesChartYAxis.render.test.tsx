import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Bar, BarChart, YAxis } from 'recharts';
import { BalancesChartYAxisTick } from '@/features/analytics/components/BalancesChartYAxisTick';
import {
  asymmetricZeroAxisTicks,
  formatBalancesAxisValue,
} from '@/features/analytics/utils/balancesChartAxis';

describe('BalancesChartYAxisTick', () => {
  it('renders explicit asymmetric ticks on the chart Y axis', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(80_000, 8_000, 9);

    render(
      <BarChart
        width={400}
        height={240}
        data={[{ bank: 'Test', cash: 80_000, credit: -8_000, investments: 0, loan: 0 }]}
        stackOffset="sign"
        margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
      >
        <YAxis
          type="number"
          width={56}
          domain={domain}
          ticks={ticks}
          allowDecimals={false}
          minTickGap={0}
          tickLine={false}
          axisLine={false}
          tick={(props) => (
            <BalancesChartYAxisTick
              {...props}
              fill="#64748b"
              fontSize={12}
              formatValue={formatBalancesAxisValue}
            />
          )}
        />
        <Bar dataKey="cash" stackId="balance" fill="#10b981" />
        <Bar dataKey="credit" stackId="balance" fill="#f43f5e" />
      </BarChart>
    );

    expect(screen.getByText('80k')).toBeTruthy();
    expect(screen.getByText('-20k')).toBeTruthy();
    expect(screen.getByText('-10k')).toBeTruthy();
    expect(screen.getByText('20k')).toBeTruthy();
    expect(screen.getByText('40k')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });
});
