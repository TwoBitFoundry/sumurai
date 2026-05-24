import { BrushCleaning, Sparkles } from 'lucide-react';
import { cn } from '@/ui/primitives/utils';
import { control } from '@/ui/recipes';

type AutoCategorizeIconProps = {
  className?: string;
};

export function AutoCategorizeIcon({ className }: AutoCategorizeIconProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      <BrushCleaning className={control.glyph.md} aria-hidden />
      <Sparkles className={cn(control.glyph.sm, 'absolute -right-1 -top-1')} aria-hidden />
    </span>
  );
}
