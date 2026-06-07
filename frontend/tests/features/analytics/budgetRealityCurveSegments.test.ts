import { describe, expect, it } from 'bun:test';
import { buildBudgetRealityCurveSegments } from '@/features/analytics/utils/budgetRealityCurveSegments';

const underColor = 'green';
const overColor = 'red';

function point(x: number, y: number, expenses: number) {
  return { x, y, value: expenses, payload: { expenses } };
}

describe('buildBudgetRealityCurveSegments', () => {
  it('keeps a fully under-budget line green', () => {
    const segments = buildBudgetRealityCurveSegments(
      [point(0, 100, 150), point(100, 120, 180), point(200, 140, 190)],
      202,
      underColor,
      overColor
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.color).toBe(underColor);
    expect(segments[0]?.points).toHaveLength(3);
  });

  it('splits at the budget crossing between months', () => {
    const segments = buildBudgetRealityCurveSegments(
      [point(0, 140, 150), point(100, 80, 572.53)],
      202,
      underColor,
      overColor
    );

    expect(segments).toHaveLength(2);
    expect(segments[0]?.color).toBe(underColor);
    expect(segments[1]?.color).toBe(overColor);
    expect(segments[0]?.points.at(-1)?.payload?.expenses).toBe(202);
    expect(segments[1]?.points[0]?.payload?.expenses).toBe(202);
  });

  it('merges consecutive edges on the same side of the budget', () => {
    const segments = buildBudgetRealityCurveSegments(
      [point(0, 140, 150), point(100, 130, 180), point(200, 120, 190)],
      202,
      underColor,
      overColor
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.points).toHaveLength(3);
  });
});
