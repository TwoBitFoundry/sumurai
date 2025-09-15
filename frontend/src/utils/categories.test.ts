import { describe, it, expect } from 'vitest'
import { formatCategoryName, getTagThemeForCategory } from './categories'

describe('categories utils', () => {
  it('formats category names from snake_case', () => {
    expect(formatCategoryName('fast_food')).toBe('Fast Food')
    expect(formatCategoryName('TRANSPORT')).toBe('Transport')
    expect(formatCategoryName(undefined)).toBe('Other')
    expect(formatCategoryName(null as any)).toBe('Other')
  })

  it('maps same name to stable theme', () => {
    const a = getTagThemeForCategory('Groceries')
    const b = getTagThemeForCategory('groceries')
    expect(a.key).toBeDefined()
    expect(a.tag).toBeDefined()
    expect(a.ring).toBeDefined()
    expect(a.ringHex).toBeDefined()
    expect(a.key).toEqual(b.key)
    expect(a.tag).toEqual(b.tag)
    expect(a.ringHex).toEqual(b.ringHex)
  })
})

