import '@testing-library/jest-dom';
import { afterEach, beforeEach, jest, mock } from 'bun:test';
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { cleanup } from '@testing-library/react';
import { AuthService } from '@/services/authService';
import { BrowserStorageAdapter } from '@/services/boundaries';

(globalThis as any).crypto = webcrypto as unknown as Crypto;

if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

jest.setTimeout(10_000);

mock.module('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    system: [],
    custom: [],
    all: [],
    accentIndexByName: new Map<string, number>(),
    isLoading: false,
    error: null,
  }),
}));

AuthService.configure({
  storage: new BrowserStorageAdapter(),
});

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
    transaction_count: 10,
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
    transaction_count: 4,
  },
];

const originalFetch = (globalThis as any).fetch;

beforeEach(() => {
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
        user_provider: 'plaid',
        teller_application_id: null,
        teller_environment: 'development',
      });
    }

    return jsonResponse({});
  });
});

afterEach(async () => {
  jest.useRealTimers();
  jest.clearAllMocks();
  cleanup();
  if (originalFetch) {
    (globalThis as any).fetch = originalFetch;
  } else {
    delete (globalThis as any).fetch;
  }
});
