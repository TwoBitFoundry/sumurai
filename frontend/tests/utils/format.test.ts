import { describe, it, expect } from 'vitest'
import { fmtUSD } from '@/utils/format'

describe('fmtUSD', () => {
  it('formats positive numbers', () => {
    expect(fmtUSD(1234.56)).toBe('$1,234.56')
  })

  it('formats negative numbers', () => {
    expect(fmtUSD(-12.3)).toBe('-$12.30')
  })

  it('handles strings and NaN gracefully', () => {
    expect(fmtUSD('1000')).toBe('$1,000.00')
    expect(fmtUSD('abc' as any)).toBe('$0.00')
    expect(fmtUSD(NaN as any)).toBe('$0.00')
  })

  it('handles large values', () => {
    expect(fmtUSD(1000000)).toBe('$1,000,000.00')
  })
})
