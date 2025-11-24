import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  test
} from '@jest/globals'

export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test }

export const vi = {
  ...jest,
  fn: jest.fn,
  spyOn: jest.spyOn,
  mock: jest.mock,
  mocked: <T>(item: T): jest.Mocked<T> => item as unknown as jest.Mocked<T>,
  clearAllMocks: jest.clearAllMocks,
  resetAllMocks: jest.resetAllMocks,
  restoreAllMocks: jest.restoreAllMocks,
  useFakeTimers: jest.useFakeTimers.bind(jest),
  useRealTimers: jest.useRealTimers.bind(jest),
  advanceTimersByTime: jest.advanceTimersByTime.bind(jest),
  runAllTimers: jest.runAllTimers.bind(jest)
}
