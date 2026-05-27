/// <reference types="bun-types" />

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { createMockFunction } from '../mocks/mockHttpClient';

const createAutoMock = () =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__esModule') return true;
        if (typeof prop === 'symbol') return undefined;
        return createMockFunction();
      },
    }
  );

const jestCompat = Object.assign(jest, {
  mocked: <T>(item: T): T => item,
  mock: (moduleId: string, factory?: () => unknown) => {
    if (typeof factory === 'function') {
      mock.module(moduleId, factory);
      return;
    }
    mock.module(moduleId, () => createAutoMock());
  },
  requireMock: (moduleId: string) => require(moduleId),
  requireActual: (moduleId: string) => require(moduleId),
});

Object.assign(globalThis, {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest: jestCompat,
  mock,
  spyOn,
  test,
});
