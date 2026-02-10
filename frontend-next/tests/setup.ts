import '@testing-library/jest-dom';
import React from 'react';
import { jest } from '@jest/globals';
import 'cross-fetch/polyfill';
import { AuthService } from '@/services/authService';
import { FetchHttpClient, BrowserStorageAdapter } from '@/services/boundaries';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

(globalThis as any).crypto = webcrypto as unknown as Crypto;
const originalFetch = (globalThis as any).fetch;
let randomSpy: jest.Spied<typeof Math.random> | null = null;
let dateNowSpy: jest.Spied<typeof Date.now> | null = null;
const defaultAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_current: 1200,
    balance_available: 1200,
    mask: '1111',
    provider: 'plaid',
    institution_name: 'Mock Bank',
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_current: 5400,
    balance_available: 5400,
    mask: '2222',
    provider: 'plaid',
    institution_name: 'Mock Bank',
  },
];

jest.setTimeout(10_000);

if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

expect.extend({
  toHaveBeenCalledOnce(received: jest.Mock | jest.Spied<any>) {
    const calls = (received as jest.Mock).mock?.calls?.length ?? 0;
    const pass = calls === 1;
    return {
      pass,
      message: () => `expected mock to have been called once, but was called ${calls} times`,
    };
  },
});

jest.mock('@/observability/TelemetryService', () => ({
  TelemetryService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockImplementation(async () => {}),
    shutdown: jest.fn().mockImplementation(async () => {}),
    getTracer: jest.fn().mockReturnValue(null),
  })),
}));

AuthService.configure({
  storage: new BrowserStorageAdapter(),
});

beforeEach(() => {
  jest.useRealTimers();
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });

  (globalThis as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/providers/accounts') || url.includes('/plaid/accounts')) {
      return jsonResponse(defaultAccounts);
    }

    if (url.includes('/providers/info')) {
      return jsonResponse({
        available_providers: ['plaid', 'teller'],
        default_provider: 'plaid',
        user_provider: 'plaid',
        teller_application_id: null,
        teller_environment: 'development',
      });
    }

    return jsonResponse({});
  });
});

(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.callback = callback;
  }
  callback: IntersectionObserverCallback;
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!(globalThis as any).requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
}
if (!(globalThis as any).cancelAnimationFrame) {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as any);
}

Object.defineProperty(globalThis, 'scrollTo', {
  value: () => {},
  writable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    value: () => {},
    writable: true,
  });

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });
}

afterEach(async () => {
  randomSpy?.mockRestore();
  randomSpy = null;
  dateNowSpy?.mockRestore();
  dateNowSpy = null;
  jest.useRealTimers();
  jest.useRealTimers?.();
  jest.clearAllTimers();
  jest.clearAllTimers?.();
  jest.clearAllMocks();
  jest.clearAllMocks?.();
  if (originalFetch) {
    (globalThis as any).fetch = originalFetch;
  } else {
    delete (globalThis as any).fetch;
  }
});

jest.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({
    open: jest.fn(),
    ready: true,
    error: null,
  }),
}));

const filterProps = (props: Record<string, unknown>) => {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      safe[key] = value;
    } else if (/^on[A-Z]/.test(key)) {
      safe[key] = value;
    } else if (['className', 'style', 'id', 'role', 'tabIndex', 'title'].includes(key)) {
      safe[key] = value;
    }
  }
  return safe;
};

const createRechartsComponent = (name: string) =>
  React.forwardRef<any, Record<string, unknown>>(({ children, ...rest }, ref) =>
    React.createElement(
      'div',
      {
        ref,
        'data-recharts-mock': name,
        ...filterProps(rest as Record<string, unknown>),
      },
      children as React.ReactNode
    )
  );

jest.mock('recharts', () => {
  const ResponsiveContainer = ({
    width,
    height,
    children,
    style,
    ...rest
  }: {
    width?: number | string;
    height?: number | string;
    children:
      | React.ReactNode
      | ((dimensions: { width: number; height: number }) => React.ReactNode);
    style?: React.CSSProperties;
  }) => {
    const fallbackWidth = 400;
    const fallbackHeight = 300;
    const resolvedWidth = typeof width === 'number' ? width : fallbackWidth;
    const resolvedHeight = typeof height === 'number' ? height : fallbackHeight;
    const content =
      typeof children === 'function'
        ? children({ width: resolvedWidth, height: resolvedHeight })
        : children;

    return React.createElement(
      'div',
      {
        'data-recharts-mock': 'ResponsiveContainer',
        style: {
          width: typeof width === 'string' ? fallbackWidth : resolvedWidth,
          height: typeof height === 'string' ? fallbackHeight : resolvedHeight,
          ...style,
        },
        ...filterProps(rest as Record<string, unknown>),
      },
      content as React.ReactNode
    );
  };

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
  };
});
