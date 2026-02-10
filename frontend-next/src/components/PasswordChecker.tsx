import type { PasswordValidation } from '@/hooks/usePasswordValidation';
import { cn, GlassCard, RequirementPill } from '@/ui/primitives';

interface PasswordCheckerProps {
  validation: PasswordValidation;
  className?: string;
}

export function PasswordChecker({ validation, className }: PasswordCheckerProps) {
  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="sm"
      withInnerEffects={false}
      className={cn(
        'space-y-1.5',
        'text-[0.7rem]',
        'text-slate-600',
        'dark:text-slate-300',
        className
      )}
    >
      <h3
        className={cn(
          'text-[0.65rem]',
          'font-semibold',
          'uppercase',
          'text-slate-700',
          'dark:text-slate-200'
        )}
      >
        Password checklist
      </h3>
      <div className={cn('flex', 'flex-wrap', 'gap-1.5')}>
        <RequirementPill status={validation.minLength ? 'met' : 'pending'}>
          8+ characters
        </RequirementPill>
        <RequirementPill status={validation.hasCapital ? 'met' : 'pending'}>
          1 capital letter
        </RequirementPill>
        <RequirementPill status={validation.hasNumber ? 'met' : 'pending'}>
          1 number
        </RequirementPill>
        <RequirementPill status={validation.hasSpecial ? 'met' : 'pending'}>
          1 special character
        </RequirementPill>
      </div>
    </GlassCard>
  );
}
