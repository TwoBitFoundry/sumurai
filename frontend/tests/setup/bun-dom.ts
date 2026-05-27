import { mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { plugin } from 'bun';
import React from 'react';

GlobalRegistrator.register();

mock.module('next/image', () => ({
  __esModule: true,
  default: ({
    alt,
    src,
    width,
    height,
    ...rest
  }: {
    alt?: string;
    src?: string | { src?: string };
    width?: number;
    height?: number;
  }) =>
    React.createElement('img', {
      alt: alt ?? '',
      src: typeof src === 'string' ? src : (src?.src ?? '/test.png'),
      'data-width': width,
      'data-height': height,
      ...rest,
    }),
}));

(globalThis as any).ResizeObserver = class {
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

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(globalThis, 'scrollTo', {
  value: () => {},
  writable: true,
});

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});

if (!(globalThis as any).requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
}
if (!(globalThis as any).cancelAnimationFrame) {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as number);
}

plugin({
  name: 'css-stub',
  setup(build) {
    build.onLoad({ filter: /\.(css|scss|sass|less)$/ }, () => ({
      exports: { default: new Proxy({}, { get: (_, k) => String(k) }) },
      loader: 'object',
    }));
  },
});
