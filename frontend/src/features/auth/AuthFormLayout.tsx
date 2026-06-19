import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { authLayout } from '@/ui/recipes';

type AuthFormLayoutProps = {
  children: ReactNode;
};

export function AuthFormLayout({ children }: AuthFormLayoutProps) {
  return (
    <>
      <div className={cn(authLayout.brandBackdrop)} aria-hidden>
        <img
          src="/sumurai-logo-no-background.webp"
          alt=""
          className={cn(authLayout.brandBackdropImage)}
        />
      </div>
      <div className={cn(authLayout.shell)}>
        <GlassCard variant="auth" padding="lg" containerClassName={cn(authLayout.card)}>
          {children}
        </GlassCard>
      </div>
    </>
  );
}
