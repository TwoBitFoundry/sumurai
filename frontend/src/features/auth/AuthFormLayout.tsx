import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { authLayout } from '@/ui/recipes';

type AuthFormLayoutProps = {
  children: ReactNode;
};

export function AuthFormLayout({ children }: AuthFormLayoutProps) {
  return (
    <div className={cn(authLayout.shell)}>
      <div className={cn(authLayout.brandAside)}>
        <img
          src="/sumurai-logo-no-background.webp"
          alt="Sumurai"
          className={cn(authLayout.brandAsideImage)}
        />
      </div>
      <GlassCard variant="auth" padding="lg" containerClassName={cn(authLayout.card)}>
        {children}
      </GlassCard>
    </div>
  );
}
