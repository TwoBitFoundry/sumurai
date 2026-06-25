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
        <div className={cn(authLayout.brandBackdropInner)}>
          <img
            src="/brand-images/Sumarai-AvatarOnly.svg"
            alt=""
            className={cn(authLayout.brandBackdropImage)}
          />
        </div>
      </div>
      <div className={cn(authLayout.shell)}>
        <GlassCard variant="auth" padding="lg" containerClassName={cn(authLayout.card)}>
          {children}
        </GlassCard>
      </div>
    </>
  );
}
