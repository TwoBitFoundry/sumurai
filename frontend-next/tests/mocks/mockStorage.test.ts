import { createMockStorage } from './mockStorage'

describe('createMockStorage', () => {
  it('returns an IStorageAdapter with all required methods', () => {
    const mockStorage = createMockStorage()
    expect(mockStorage).toBeDefined()
    expect(typeof mockStorage.getItem).toBe('function')
    expect(typeof mockStorage.setItem).toBe('function')
    expect(typeof mockStorage.removeItem).toBe('function')
    expect(typeof mockStorage.clear).toBe('function')
  })

  it('setItem and getItem work correctly', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('key', 'value')
    const result = mockStorage.getItem('key')
    expect(result).toBe('value')
  })

  it('getItem returns null for non-existent keys', () => {
    const mockStorage = createMockStorage()
    const result = mockStorage.getItem('non-existent')
    expect(result).toBeNull()
  })

  it('multiple items can be stored and retrieved', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('key1', 'value1')
    mockStorage.setItem('key2', 'value2')
    mockStorage.setItem('key3', 'value3')

    expect(mockStorage.getItem('key1')).toBe('value1')
    expect(mockStorage.getItem('key2')).toBe('value2')
    expect(mockStorage.getItem('key3')).toBe('value3')
  })

  it('setItem overwrites existing values', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('key', 'value1')
    expect(mockStorage.getItem('key')).toBe('value1')

    mockStorage.setItem('key', 'value2')
    expect(mockStorage.getItem('key')).toBe('value2')
  })

  it('removeItem deletes a stored item', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('key', 'value')
    expect(mockStorage.getItem('key')).toBe('value')

    mockStorage.removeItem('key')
    expect(mockStorage.getItem('key')).toBeNull()
  })

  it('removeItem on non-existent key does not throw', () => {
    const mockStorage = createMockStorage()
    expect(() => mockStorage.removeItem('non-existent')).not.toThrow()
  })

  it('clear removes all items', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('key1', 'value1')
    mockStorage.setItem('key2', 'value2')
    mockStorage.setItem('key3', 'value3')

    mockStorage.clear()

    expect(mockStorage.getItem('key1')).toBeNull()
    expect(mockStorage.getItem('key2')).toBeNull()
    expect(mockStorage.getItem('key3')).toBeNull()
  })

  it('each call to createMockStorage creates a new isolated store', () => {
    const mockStorage1 = createMockStorage()
    const mockStorage2 = createMockStorage()

    mockStorage1.setItem('key', 'value1')
    mockStorage2.setItem('key', 'value2')

    expect(mockStorage1.getItem('key')).toBe('value1')
    expect(mockStorage2.getItem('key')).toBe('value2')
  })

  it('handles JSON string values correctly', () => {
    const mockStorage = createMockStorage()
    const jsonData = JSON.stringify({ user: 'john', age: 30 })
    mockStorage.setItem('user-data', jsonData)

    const retrieved = mockStorage.getItem('user-data')
    const parsed = JSON.parse(retrieved!)
    expect(parsed).toEqual({ user: 'john', age: 30 })
  })

  it('handles empty string values', () => {
    const mockStorage = createMockStorage()
    mockStorage.setItem('empty', '')
    expect(mockStorage.getItem('empty')).toBe('')
  })
})
