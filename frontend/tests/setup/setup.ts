import '@testing-library/jest-dom'
import { vi } from 'vitest'

;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

;(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
  }
  callback: IntersectionObserverCallback
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!(globalThis as any).requestAnimationFrame) {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number
}
if (!(globalThis as any).cancelAnimationFrame) {
  ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as any)
}

if (!(globalThis as any).scrollTo) {
  ;(globalThis as any).scrollTo = () => {}
}
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {}
}

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true
})

vi.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({
    open: vi.fn(),
    ready: true,
    error: null,
  })
}))
