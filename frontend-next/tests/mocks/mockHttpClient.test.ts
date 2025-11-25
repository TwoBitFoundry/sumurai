import { createMockHttpClient } from './mockHttpClient'

describe('createMockHttpClient', () => {
  it('returns an IHttpClient with all required methods', () => {
    const mockHttp = createMockHttpClient()
    expect(mockHttp).toBeDefined()
    expect(typeof mockHttp.get).toBe('function')
    expect(typeof mockHttp.post).toBe('function')
    expect(typeof mockHttp.put).toBe('function')
    expect(typeof mockHttp.delete).toBe('function')
    expect(typeof mockHttp.healthCheck).toBe('function')
  })

  it('all methods are jest.fn() spies that can be mocked', () => {
    const mockHttp = createMockHttpClient()
    expect(mockHttp.get.mock).toBeDefined()
    expect(mockHttp.post.mock).toBeDefined()
    expect(mockHttp.put.mock).toBeDefined()
    expect(mockHttp.delete.mock).toBeDefined()
    expect(mockHttp.healthCheck.mock).toBeDefined()
  })

  it('allows mocking return values on get', async () => {
    const mockHttp = createMockHttpClient()
    const mockData = { id: 1, name: 'test' }
    mockHttp.get.mockResolvedValueOnce(mockData)

    const result = await mockHttp.get('/test')
    expect(result).toEqual(mockData)
    expect(mockHttp.get).toHaveBeenCalledWith('/test')
  })

  it('allows mocking return values on post', async () => {
    const mockHttp = createMockHttpClient()
    const mockResponse = { success: true, id: 123 }
    mockHttp.post.mockResolvedValueOnce(mockResponse)

    const result = await mockHttp.post('/api/users', { name: 'John' })
    expect(result).toEqual(mockResponse)
    expect(mockHttp.post).toHaveBeenCalledWith('/api/users', { name: 'John' })
  })

  it('allows mocking return values on put', async () => {
    const mockHttp = createMockHttpClient()
    const mockResponse = { updated: true }
    mockHttp.put.mockResolvedValueOnce(mockResponse)

    const result = await mockHttp.put('/api/users/1', { name: 'Jane' })
    expect(result).toEqual(mockResponse)
    expect(mockHttp.put).toHaveBeenCalledWith('/api/users/1', { name: 'Jane' })
  })

  it('allows mocking return values on delete', async () => {
    const mockHttp = createMockHttpClient()
    mockHttp.delete.mockResolvedValueOnce({})

    const result = await mockHttp.delete('/api/users/1')
    expect(result).toEqual({})
    expect(mockHttp.delete).toHaveBeenCalledWith('/api/users/1')
  })

  it('allows mocking return values on healthCheck', async () => {
    const mockHttp = createMockHttpClient()
    mockHttp.healthCheck.mockResolvedValueOnce('ok')

    const result = await mockHttp.healthCheck()
    expect(result).toBe('ok')
    expect(mockHttp.healthCheck).toHaveBeenCalled()
  })

  it('allows mocking errors on methods', async () => {
    const mockHttp = createMockHttpClient()
    const error = new Error('Network error')
    mockHttp.get.mockRejectedValueOnce(error)

    await expect(mockHttp.get('/test')).rejects.toThrow('Network error')
    expect(mockHttp.get).toHaveBeenCalledWith('/test')
  })

  it('tracks multiple calls to methods', async () => {
    const mockHttp = createMockHttpClient()
    mockHttp.get.mockResolvedValue({ data: 'test' })

    await mockHttp.get('/test1')
    await mockHttp.get('/test2')
    await mockHttp.get('/test1')

    expect(mockHttp.get).toHaveBeenCalledTimes(3)
    expect(mockHttp.get).toHaveBeenNthCalledWith(1, '/test1')
    expect(mockHttp.get).toHaveBeenNthCalledWith(2, '/test2')
    expect(mockHttp.get).toHaveBeenNthCalledWith(3, '/test1')
  })
})
