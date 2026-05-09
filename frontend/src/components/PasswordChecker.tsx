import type { PasswordValidation } from '@/hooks/usePasswordValidation';
import { cn, GlassCard, RequirementPill } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

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
      className={cn('space-y-1.5', uiTypographyRecipes.caption, uiTextRecipes.body, className)}
    >
      <h3 className={cn(uiTypographyRecipes.label, uiTextRecipes.label)}>Password checklist</h3>
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
