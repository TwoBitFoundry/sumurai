import { jest } from 'bun:test';
import { act, fireEvent } from '@testing-library/react';

export async function flushProgrammaticFrames(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
}

export async function advanceProgrammaticTime(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms + 1);
    jest.runOnlyPendingTimers();
  });
}

export async function completeExitAnimation(target: Element): Promise<void> {
  await flushProgrammaticFrames();
  fireEvent.animationEnd(target);
}

export async function withProgrammaticTimers<T>(run: () => T | Promise<T>): Promise<T> {
  jest.useFakeTimers();
  try {
    return await run();
  } finally {
    jest.useRealTimers();
  }
}
