import { jest } from 'bun:test';
import type { IHttpClient } from '@/services/boundaries/IHttpClient';

export type MockFunction = ReturnType<typeof jest.fn>;

export type MockHttpClient = {
  [K in keyof IHttpClient]: MockFunction;
};

export function createMockFunction(): MockFunction {
  return jest.fn();
}

export function createMockHttpClient(): MockHttpClient {
  return {
    get: createMockFunction(),
    getBlob: createMockFunction(),
    post: createMockFunction(),
    postFormData: createMockFunction(),
    put: createMockFunction(),
    delete: createMockFunction(),
    healthCheck: createMockFunction(),
  };
}
