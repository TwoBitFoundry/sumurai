export function varianceChartDomain(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return [0, 0];
  }

  const dataMin = Math.min(...finite, 0);
  const dataMax = Math.max(...finite, 0);
  const span = dataMax - dataMin;

  if (span <= 0) {
    const center = finite[0] ?? 0;
    const pad = Math.max(Math.abs(center) * 0.12, 50);
    return [center - pad, center + pad];
  }

  const pad = Math.max(span * 0.12, 1);
  return [dataMin - pad, dataMax + pad];
}

export function realityChartDomain(expenses: number[], totalBudget: number): [number, number] {
  const finite = expenses.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const numericBudget = Number(totalBudget);
  const anchors = [...finite, 0, numericBudget];
  if (finite.length === 0) {
    const pad = Math.max(numericBudget * 0.12, 50);
    return [0, numericBudget + pad];
  }

  const dataMin = Math.min(...anchors);
  const dataMax = Math.max(...anchors);
  const span = dataMax - dataMin;

  if (span <= 0) {
    const center = finite[0] ?? numericBudget;
    const pad = Math.max(Math.abs(center) * 0.12, 50);
    return [Math.max(0, center - pad), center + pad];
  }

  const pad = Math.max(span * 0.12, 1);
  return [Math.max(0, dataMin - pad), dataMax + pad];
}
