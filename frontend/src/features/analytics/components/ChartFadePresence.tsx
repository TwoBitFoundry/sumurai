import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';

type Props = {
  stateKey: string;
  children: ReactNode;
  className?: string;
};

export function ChartFadePresence({ stateKey, children, className }: Props) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        className={cn('flex', 'flex-col', 'flex-1', 'min-h-0', 'w-full', 'min-w-0', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
