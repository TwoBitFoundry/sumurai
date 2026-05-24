import type { ViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives/utils';

export function getToastStackLayoutClassName(breakpoint: ViewportBreakpoint): string {
  switch (breakpoint) {
    case 'mobile':
      return cn(
        'fixed',
        'z-[60]',
        'left-[calc(1rem+env(safe-area-inset-left))]',
        'right-[calc(1rem+env(safe-area-inset-right))]',
        'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]',
        'flex',
        'w-auto',
        'max-w-none',
        'flex-col-reverse',
        'items-stretch',
        'gap-2'
      );
    case 'tablet':
      return cn(
        'fixed',
        'z-[60]',
        'right-[calc(1rem+env(safe-area-inset-right))]',
        'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]',
        'flex',
        'w-[min(100%,28rem)]',
        'max-w-md',
        'flex-col-reverse',
        'items-stretch',
        'gap-2'
      );
    case 'desktop':
      return cn(
        'fixed',
        'z-[60]',
        'right-6',
        'bottom-6',
        'flex',
        'w-full',
        'max-w-lg',
        'flex-col-reverse',
        'items-stretch',
        'gap-2'
      );
  }
}
