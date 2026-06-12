import { describe, expect, it } from 'bun:test';
import {
  easeOutCubic,
  interpolateNumbers,
  numbersMatch,
  sankeyLinkAnimationKeys,
  sankeyNodeAnimationKeys,
} from '@/features/analytics/hooks/sankeyChartAnimation';

describe('sankeyChartAnimation', () => {
  it('eases out toward the end of the transition', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });

  it('interpolates numeric shape props toward the target', () => {
    const from = { x: 0, y: 10, width: 14, height: 40 };
    const to = { x: 100, y: 50, width: 14, height: 120 };

    expect(interpolateNumbers(from, to, sankeyNodeAnimationKeys, 0.5)).toMatchObject({
      x: 87.5,
      y: 45,
      width: 14,
      height: 110,
    });
  });

  it('interpolates link geometry and width', () => {
    const from = {
      sourceX: 0,
      sourceY: 20,
      sourceControlX: 40,
      targetX: 200,
      targetY: 30,
      targetControlX: 160,
      linkWidth: 10,
    };
    const to = {
      sourceX: 10,
      sourceY: 24,
      sourceControlX: 60,
      targetX: 220,
      targetY: 36,
      targetControlX: 180,
      linkWidth: 24,
    };

    expect(interpolateNumbers(from, to, sankeyLinkAnimationKeys, 1)).toEqual(to);
  });

  it('detects unchanged numeric props', () => {
    const values = { x: 12, y: 34, width: 14, height: 88 };
    expect(numbersMatch(values, values, sankeyNodeAnimationKeys)).toBe(true);
    expect(numbersMatch(values, { ...values, y: 35 }, sankeyNodeAnimationKeys)).toBe(false);
  });
});
