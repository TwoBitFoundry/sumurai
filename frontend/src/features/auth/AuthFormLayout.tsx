import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';

type AuthFormLayoutProps = {
  children: ReactNode;
};

export function AuthFormLayout({ children }: AuthFormLayoutProps) {
  return (
    <div
      className={cn(
        'relative',
        'flex',
        'w-full',
        'max-w-md',
        'flex-col',
        'items-center',
        'justify-center',
        'px-4',
        'py-8',
        'md:px-6'
      )}
    >
      <div
        className={cn(
          'hidden',
          'lg:flex',
          'fixed',
          'right-0',
          'top-0',
          'bottom-0',
          'w-1/2',
          'items-end',
          'justify-end',
          'pointer-events-none',
          'z-0'
        )}
      >
        <img
          src="/sumurai-logo-no-background.webp"
          alt="Sumurai"
          className={cn('h-full', 'w-full', 'object-contain', 'object-right-bottom')}
        />
      </div>
      <GlassCard variant="auth" padding="lg" className={cn('relative', 'z-10', 'w-full')}>
        {children}
      </GlassCard>
    </div>
  );
}
