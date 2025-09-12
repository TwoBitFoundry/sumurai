import '@testing-library/jest-dom'
import { vi } from 'vitest'

;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

;(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Store callback for potential test usage
    this.callback = callback
  }
  callback: IntersectionObserverCallback
  observe() {}
  unobserve() {}
  disconnect() {}
}

// JSDOM shims for animation frames used by charting libs
if (!(globalThis as any).requestAnimationFrame) {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number
}
if (!(globalThis as any).cancelAnimationFrame) {
  ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as any)
}

// JSDOM shim for window.scrollTo used by animation libraries
if (!(globalThis as any).scrollTo) {
  ;(globalThis as any).scrollTo = () => {}
}
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {}
}

// Mock react-plaid-link to prevent external script loading in tests
vi.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({
    open: vi.fn(),
    ready: true,
    error: null,
  })
}))
