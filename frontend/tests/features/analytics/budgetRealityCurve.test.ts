import { describe, expect, it } from 'bun:test';
import { budgetCurveClipBounds, budgetLineY } from '@/features/analytics/utils/budgetRealityCurve';

function point(x: number, y: number, expenses: number) {
  return { x, y, value: expenses, payload: { expenses } };
}

describe('budgetLineY', () => {
  it('returns the pixel y where spending crosses the budget', () => {
    const budgetY = budgetLineY([point(200, 300, 0), point(300, 20, 573)], 202);

    expect(budgetY).toBeCloseTo(300 + (20 - 300) * (202 / 573), 5);
  });

  it('places the clip below all points when spending stays under budget', () => {
    const budgetY = budgetLineY(
      [point(0, 300, 0), point(100, 280, 150), point(200, 260, 180)],
      202
    );

    expect(budgetY).toBeGreaterThan(260);
  });

  it('places the clip above all points when spending stays over budget', () => {
    const budgetY = budgetLineY([point(0, 120, 500), point(100, 80, 600)], 202);

    expect(budgetY).toBeLessThan(80);
  });
});

describe('budgetCurveClipBounds', () => {
  it('expands clip bounds beyond the rendered points', () => {
    const bounds = budgetCurveClipBounds([point(100, 300, 0), point(300, 20, 573)]);

    expect(bounds.minX).toBeLessThan(100);
    expect(bounds.width).toBeGreaterThan(200);
    expect(bounds.maxY).toBeGreaterThan(300);
  });
});
