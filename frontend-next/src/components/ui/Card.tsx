import React from 'react';
import { GlassCard } from '@/ui/primitives/GlassCard';
import { cn } from '@/ui/primitives/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function Card({ children, className, containerClassName }: CardProps) {
  return (
    <GlassCard containerClassName={containerClassName} className={cn('p-6', className)}>
      {children}
    </GlassCard>
  );
}

export default Card;
