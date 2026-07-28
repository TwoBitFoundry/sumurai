/// <reference types="bun-types/test-globals" />

import type { expect } from 'bun:test';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'bun:test' {
  interface Matchers<T = unknown>
    extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, T> {
    toHaveBeenCalledOnce(): T;
  }

  namespace jest {
    function mock(moduleId: string, factory?: () => unknown): void;
    function mocked<T extends (...args: any[]) => any>(item: T): Mock<T>;
    function mocked<T>(item: T): T;
    function requireMock(moduleId: string): unknown;
    function requireActual(moduleId: string): unknown;
    type MockedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = Mock<T>;
    type SpiedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = Spied<T>;
  }
}

declare global {
  namespace jest {
    type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> =
      import('bun:test').Mock<T>;
    type Spied<T extends (...args: any[]) => any> = import('bun:test').Spied<T>;
    type MockedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = Mock<T>;
    type SpiedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = Spied<T>;
  }
}
