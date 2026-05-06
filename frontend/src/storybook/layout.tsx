import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';

export function StoryFullscreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('min-h-screen w-full', className)}>{children}</div>;
}
