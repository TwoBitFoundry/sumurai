import { designTokens, getThemeColors as getThemeColorsFromIndex } from '@/ui/tokens';
import {
  accountTypeDot,
  categoryAccents,
  chart,
  featurePalettes,
  finance,
  getCategoryAccent,
  getHeroAccentTheme,
  getThemeColors,
  heroAccents,
} from '@/ui/tokens-runtime';

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
    expect(getThemeColors('light')).toEqual(designTokens.colors.theme.light);
    expect(getThemeColors('dark')).toEqual(designTokens.colors.theme.dark);
    expect(getThemeColorsFromIndex('light')).toEqual(getThemeColors('light'));
    expect(getCategoryAccent('Groceries')).toEqual(getCategoryAccent('Groceries'));
    expect(getHeroAccentTheme('sky')).toEqual(heroAccents.sky);
  });
});
