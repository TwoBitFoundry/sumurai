import { mock } from 'bun:test';
import React from 'react';

mock.module('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) =>
      React.createElement('div', props, children),
  },
}));
