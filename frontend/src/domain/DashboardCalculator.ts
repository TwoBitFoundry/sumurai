interface NetWorthPoint {
  date: string
  value: number
}

export class DashboardCalculator {
  static calculateNetYAxisDomain(series: NetWorthPoint[]): [number, number] | null {
    if (!series || series.length === 0) return null

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (const point of series) {
      const value = Number(point?.value)
      if (!Number.isFinite(value)) continue
      if (value < min) min = value
      if (value > max) max = value
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return null

    if (min === max) {
      const padding = Math.max(Math.abs(max) * 0.1, 500)
      return [max - padding, max + padding]
    }

    const span = Math.abs(max - min)
    const padding = Math.max(span * 0.08, 500)
    return [min - padding, max + padding]
  }

  static calculateNetDotIndices(series: NetWorthPoint[]): Set<number> {
    const selected = new Set<number>()
    const n = series?.length || 0

    if (!n) return selected

    const changeIdx: number[] = []
    for (let i = 1; i < n; i++) {
      const prev = Number(series[i - 1]?.value ?? 0)
      const curr = Number(series[i]?.value ?? 0)
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue
      if (curr !== prev) changeIdx.push(i)
    }

    const maxDots = 30
    if (changeIdx.length > 0) {
      const stride = Math.max(1, Math.ceil(changeIdx.length / maxDots))
      for (let k = 0; k < changeIdx.length; k += stride) selected.add(changeIdx[k])
      selected.add(changeIdx[changeIdx.length - 1])
    }

    return selected
  }
}
