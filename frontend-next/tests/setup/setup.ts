import '@testing-library/jest-dom'
import React from 'react'
import { AuthService } from '@/services/authService'
import { FetchHttpClient, BrowserStorageAdapter } from '@/services/boundaries'

jest.mock('@/observability/TelemetryService', () => ({
  TelemetryService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getTracer: jest.fn().mockReturnValue(null),
  })),
}))

AuthService.configure({
  http: new FetchHttpClient(),
  storage: new BrowserStorageAdapter()
})

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

Object.defineProperty(globalThis, 'scrollTo', {
  value: () => {},
  writable: true
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    value: () => {},
    writable: true
  })
}

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true
})

jest.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({
    open: jest.fn(),
    ready: true,
    error: null,
  })
}))

const filterProps = (props: Record<string, unknown>) => {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      safe[key] = value
    } else if (/^on[A-Z]/.test(key)) {
      safe[key] = value
    } else if (['className', 'style', 'id', 'role', 'tabIndex', 'title'].includes(key)) {
      safe[key] = value
    }
  }
  return safe
}

const createRechartsComponent = (name: string) =>
  React.forwardRef<any, Record<string, unknown>>(({ children, ...rest }, ref) =>
    React.createElement(
      'div',
      {
        ref,
        'data-recharts-mock': name,
        ...filterProps(rest as Record<string, unknown>)
      },
      children
    )
  )

jest.mock('recharts', () => {
  const ResponsiveContainer = ({
    width,
    height,
    children,
    style,
    ...rest
  }: {
    width?: number | string
    height?: number | string
    children: React.ReactNode | ((dimensions: { width: number; height: number }) => React.ReactNode)
    style?: React.CSSProperties
  }) => {
    const fallbackWidth = 400
    const fallbackHeight = 300
    const resolvedWidth = typeof width === 'number' ? width : fallbackWidth
    const resolvedHeight = typeof height === 'number' ? height : fallbackHeight
    const content =
      typeof children === 'function'
        ? children({ width: resolvedWidth, height: resolvedHeight })
        : children

    return React.createElement(
      'div',
      {
        'data-recharts-mock': 'ResponsiveContainer',
        style: {
          width: typeof width === 'string' ? fallbackWidth : resolvedWidth,
          height: typeof height === 'string' ? fallbackHeight : resolvedHeight,
          ...style
        },
        ...filterProps(rest as Record<string, unknown>)
      },
      content
    )
  }

  return {
    ResponsiveContainer,
    Area: createRechartsComponent('Area'),
    AreaChart: createRechartsComponent('AreaChart'),
    Bar: createRechartsComponent('Bar'),
    BarChart: createRechartsComponent('BarChart'),
    CartesianGrid: createRechartsComponent('CartesianGrid'),
    Cell: createRechartsComponent('Cell'),
    ComposedChart: createRechartsComponent('ComposedChart'),
    Legend: createRechartsComponent('Legend'),
    Line: createRechartsComponent('Line'),
    LineChart: createRechartsComponent('LineChart'),
    Pie: createRechartsComponent('Pie'),
    PieChart: createRechartsComponent('PieChart'),
    RadialBar: createRechartsComponent('RadialBar'),
    RadialBarChart: createRechartsComponent('RadialBarChart'),
    ReferenceLine: createRechartsComponent('ReferenceLine'),
    Scatter: createRechartsComponent('Scatter'),
    ScatterChart: createRechartsComponent('ScatterChart'),
    Tooltip: createRechartsComponent('Tooltip'),
    Treemap: createRechartsComponent('Treemap'),
    XAxis: createRechartsComponent('XAxis'),
    YAxis: createRechartsComponent('YAxis'),
    PolarAngleAxis: createRechartsComponent('PolarAngleAxis'),
    PolarGrid: createRechartsComponent('PolarGrid'),
    PolarRadiusAxis: createRechartsComponent('PolarRadiusAxis'),
    Radar: createRechartsComponent('Radar'),
    RadarChart: createRechartsComponent('RadarChart'),
  }
})
