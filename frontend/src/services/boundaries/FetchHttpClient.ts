import { IHttpClient } from './IHttpClient'

export class FetchHttpClient implements IHttpClient {
  private baseUrl = '/api'

  async get<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, { method: 'DELETE' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (response.status === 204) return {} as T
    return response.json()
  }

  async healthCheck(): Promise<string> {
    const response = await fetch('/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error(`Health check failed`)
    return response.text()
  }
}
