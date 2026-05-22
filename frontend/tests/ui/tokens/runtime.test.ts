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
} from '@/ui/tokens';

describe('ui tokens runtime map', () => {
  it('exposes the chart and finance swatches used at runtime', () => {
    expect(chart.series.light).toHaveLength(6);
    expect(chart.series.dark).toHaveLength(6);
    expect(chart.series.light).toEqual(
      expect.arrayContaining(['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#059669'])
    );
    expect(chart.series.dark).toEqual(
      expect.arrayContaining(['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#10b981'])
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
  });

  it('keeps the category and hero maps stable', () => {
    expect(categoryAccents).toHaveLength(10);
    expect(categoryAccents[0]).toMatchObject({ key: 'sky', ringHex: '#38bdf8' });
    expect(accountTypeDot).toEqual({
      checking: '#38bdf8',
      savings: '#22c55e',
      credit: '#f59e0b',
      loan: '#a78bfa',
      other: '#94a3b8',
    });
    expect(heroAccents.emerald).toMatchObject({
      gradFrom: '#34d399',
      gradVia: '#10b981',
      defaultDot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    });
    expect(featurePalettes.welcome.sky.gradient).toBe(
      'from-sky-400/55 via-sky-500/25 to-sky-500/5'
    );
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
    });
    expect(getCategoryAccent('Groceries')).toEqual(getCategoryAccent('Groceries'));
    expect(getCategoryAccentByIndex(0)).toEqual(categoryAccents[0]);
    expect(getCategoryAccentByIndex(categoryAccents.length)).toEqual(categoryAccents[0]);
    expect(getHeroAccentTheme('sky')).toEqual(heroAccents.sky);
  });
});
