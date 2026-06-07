export interface BudgetRealityChartPoint {
  x: number;
  y: number;
  value?: number;
  payload?: {
    expenses: number;
  };
}

function expenseAt(point: BudgetRealityChartPoint): number {
  return Number(point.payload?.expenses ?? point.value ?? Number.NaN);
}

function isOverBudget(expenses: number, totalBudget: number): boolean {
  return Number.isFinite(expenses) && expenses > totalBudget;
}

export function budgetLineY(points: BudgetRealityChartPoint[], totalBudget: number): number | null {
  if (points.length === 0) {
    return null;
  }

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) {
      continue;
    }

    const startExpenses = expenseAt(start);
    const endExpenses = expenseAt(end);
    if (
      !Number.isFinite(startExpenses) ||
      !Number.isFinite(endExpenses) ||
      startExpenses === endExpenses
    ) {
      continue;
    }

    const startUnder = !isOverBudget(startExpenses, totalBudget);
    const endUnder = !isOverBudget(endExpenses, totalBudget);
    if (startUnder === endUnder) {
      continue;
    }

    const t = (totalBudget - startExpenses) / (endExpenses - startExpenses);
    return start.y + t * (end.y - start.y);
  }

  const expenses = points.map(expenseAt).filter(Number.isFinite);
  if (expenses.length === 0) {
    return null;
  }

  const maxExpenses = Math.max(...expenses);
  const minExpenses = Math.min(...expenses);
  if (maxExpenses <= totalBudget) {
    return Math.max(...points.map((point) => point.y)) + 1;
  }
  if (minExpenses > totalBudget) {
    return Math.min(...points.map((point) => point.y)) - 1;
  }

  return null;
}

export function budgetCurveClipBounds(points: BudgetRealityChartPoint[]) {
  const horizontalPadding = 32;
  const verticalPadding = 32;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - horizontalPadding;
  const maxX = Math.max(...xs) + horizontalPadding;
  const maxY = Math.max(...ys) + verticalPadding;

  return {
    minX,
    width: maxX - minX,
    maxY,
  };
}
