import type React from 'react';
import { cn } from './utils';

export const gradientShellRecipes = {
  root: ['relative', 'min-h-dvh'],
  centered: ['overflow-hidden'],
  backdrop: ['pointer-events-none', 'inset-0', 'gradient-shell-mesh'],
  content: ['relative', 'min-h-dvh'],
  contentCentered: 'flex min-h-dvh items-center justify-center px-4 py-12 md:px-6',
} as const;

export interface GradientShellProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}

export function GradientShell({ children, className, centered = false }: GradientShellProps) {
  return (
    <div
      className={cn(
        ...gradientShellRecipes.root,
        centered ? gradientShellRecipes.centered : '',
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(...gradientShellRecipes.backdrop, centered ? 'absolute' : 'fixed')}
        data-slot="gradient-shell-mesh"
      />

      <div
        className={cn(
          ...gradientShellRecipes.content,
          centered ? gradientShellRecipes.contentCentered : ''
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default GradientShell;
