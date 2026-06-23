import {
  accountTypeDot,
  categoryAccents,
  chart,
  featurePalettes,
  finance,
  getCategoryAccent,
  getCategoryAccentByIndex,
  getHeroAccentTheme,
  getThemeColors,
  heroAccents,
  status,
} from '@/ui/tokens';

describe('ui tokens runtime map', () => {
  it('exposes the chart and finance swatches used at runtime', () => {
    expect(chart.series.light).toHaveLength(6);
    expect(chart.series.dark).toHaveLength(6);
    expect(chart.series.light).toEqual(
      expect.arrayContaining(['#0d8acc', '#00c2a2', '#f59e0b', '#b82812', '#011e5b', '#20428c'])
    );
    expect(chart.series.dark).toEqual(
      expect.arrayContaining(['#3cbbfe', '#81fed2', '#fbbf24', '#f53519', '#20428c', '#b1e4ff'])
    );
    expect(chart.tooltip.light).toEqual({
      background: '#ffffff',
      text: '#0f172a',
      border: '#e2e8f0',
    });
    expect(chart.tooltip.dark).toEqual({
      background: '#1e293b',
      text: '#f8fafc',
      border: '#475569',
    });
    expect(finance.light.cash).toBeDefined();
    expect(finance.dark.netWorth).toBeDefined();
    expect(status.light).toEqual({
      successIcon: '#00c2a2',
      dangerIcon: '#b82812',
    });
    expect(status.dark).toEqual({
      successIcon: '#81fed2',
      dangerIcon: '#f53519',
    });
  });

  it('keeps the category and hero maps stable', () => {
    expect(categoryAccents).toHaveLength(10);
    expect(categoryAccents[0]).toMatchObject({ key: 'azure', ringHex: '#3cbbfe' });
    expect(accountTypeDot).toEqual({
      cash: '#00c2a2',
      credit: '#b82812',
      investments: '#0d8acc',
      loan: '#f59e0b',
    });
    expect(heroAccents.teal).toMatchObject({
      gradFrom: '#81fed2',
      gradVia: '#00c2a2',
      defaultDot:
        'bg-[color:color-mix(in_srgb,var(--color-brand-teal)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-mint)_80%,transparent)]',
    });
    expect(featurePalettes.welcome.azure.gradient).toContain('--color-brand-glacier');
  });

  it('keeps the helper functions aligned with the legacy registry', () => {
    expect(getThemeColors('light')).toEqual({
      chart: {
        primary: chart.series.light,
        grid: chart.grid.light,
        axis: chart.axis.light,
        tooltipBg: chart.tooltip.light.background,
        tooltipBorder: chart.tooltip.light.border,
        tooltipText: chart.tooltip.light.text,
        dotFill: chart.dot.light,
      },
      semantic: {
        cash: finance.light.cash,
        investments: finance.light.investments,
        credit: finance.light.credit,
        loan: finance.light.loan,
        netWorth: finance.light.netWorth,
      },
      effect: {
        successGlow: '#00c2a2',
        dangerGlow: '#b82812',
      },
    });
    expect(getThemeColors('dark')).toEqual({
      chart: {
        primary: chart.series.dark,
        grid: chart.grid.dark,
        axis: chart.axis.dark,
        tooltipBg: chart.tooltip.dark.background,
        tooltipBorder: chart.tooltip.dark.border,
        tooltipText: chart.tooltip.dark.text,
        dotFill: chart.dot.dark,
      },
      semantic: {
        cash: finance.dark.cash,
        investments: finance.dark.investments,
        credit: finance.dark.credit,
        loan: finance.dark.loan,
        netWorth: finance.dark.netWorth,
      },
      effect: {
        successGlow: '#81fed2',
        dangerGlow: '#f53519',
      },
    });
    expect(getCategoryAccent('Groceries')).toEqual(getCategoryAccent('Groceries'));
    expect(getCategoryAccentByIndex(0)).toEqual(categoryAccents[0]);
    expect(getCategoryAccentByIndex(categoryAccents.length)).toEqual(categoryAccents[0]);
    expect(getHeroAccentTheme('azure')).toEqual(heroAccents.azure);
  });
});
