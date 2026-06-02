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
