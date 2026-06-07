export interface BudgetRealityChartPoint {
  x: number;
  y: number;
  value?: number;
  payload?: {
    expenses: number;
  };
}

export interface BudgetRealityCurveSegment {
  points: BudgetRealityChartPoint[];
  color: string;
}

function expenseAt(point: BudgetRealityChartPoint): number {
  return point.payload?.expenses ?? Number(point.value ?? Number.NaN);
}

function isOverBudget(expenses: number, totalBudget: number): boolean {
  return Number.isFinite(expenses) && expenses > totalBudget;
}

function segmentColor(
  expenses: number,
  totalBudget: number,
  underColor: string,
  overColor: string
): string {
  return isOverBudget(expenses, totalBudget) ? overColor : underColor;
}

function interpolateBudgetCrossing(
  start: BudgetRealityChartPoint,
  end: BudgetRealityChartPoint,
  totalBudget: number
): BudgetRealityChartPoint {
  const startExpenses = expenseAt(start);
  const endExpenses = expenseAt(end);
  const span = endExpenses - startExpenses;
  const t = span === 0 ? 0.5 : (totalBudget - startExpenses) / span;
  return {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
    value: totalBudget,
    payload: { expenses: totalBudget },
  };
}

function appendSegment(
  segments: BudgetRealityCurveSegment[],
  points: BudgetRealityChartPoint[],
  color: string
) {
  if (points.length < 2) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.color === color && last.points.at(-1) === points[0]) {
    last.points.push(...points.slice(1));
    return;
  }
  segments.push({ points: [...points], color });
}

export function buildBudgetRealityCurveSegments(
  points: BudgetRealityChartPoint[],
  totalBudget: number,
  underColor: string,
  overColor: string
): BudgetRealityCurveSegment[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    const point = points[0];
    if (!point) {
      return [];
    }
    return [
      {
        points: [point],
        color: segmentColor(expenseAt(point), totalBudget, underColor, overColor),
      },
    ];
  }

  const segments: BudgetRealityCurveSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) {
      continue;
    }

    const startExpenses = expenseAt(start);
    const endExpenses = expenseAt(end);
    const startColor = segmentColor(startExpenses, totalBudget, underColor, overColor);
    const endColor = segmentColor(endExpenses, totalBudget, underColor, overColor);
    const crossesBudget =
      isOverBudget(startExpenses, totalBudget) !== isOverBudget(endExpenses, totalBudget);

    if (!crossesBudget) {
      appendSegment(segments, [start, end], startColor);
      continue;
    }

    const crossing = interpolateBudgetCrossing(start, end, totalBudget);
    appendSegment(segments, [start, crossing], startColor);
    appendSegment(segments, [crossing, end], endColor);
  }

  return segments;
}
