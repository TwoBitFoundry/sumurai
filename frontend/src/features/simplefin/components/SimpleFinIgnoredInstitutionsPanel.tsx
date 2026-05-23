import { EyeOff, RotateCcw } from 'lucide-react';
import type { SimpleFinIgnoredInstitution } from '@/types/api';
import { Button, cn, GlassCard } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { formatIgnoredInstitutionLabel } from '../utils/formatIgnoredInstitutionLabel';

interface SimpleFinIgnoredInstitutionsPanelProps {
  institutions: SimpleFinIgnoredInstitution[];
  onRestore: (orgConnId: string) => Promise<void>;
  restoringOrgConnId: string | null;
  isOnline: boolean;
}

const formatHiddenAt = (hiddenAt: string): string => {
  const date = new Date(hiddenAt);
  if (Number.isNaN(date.getTime())) {
    return 'Hidden recently';
  }

  return `Hidden ${date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

export function SimpleFinIgnoredInstitutionsPanel({
  institutions,
  onRestore,
  restoringOrgConnId,
  isOnline,
}: SimpleFinIgnoredInstitutionsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-muted)]">
          <EyeOff className="h-6 w-6" aria-hidden />
        </div>
        <h3 className={cn(uiTypographyRecipes.cardTitle, semanticTextRecipes.primary)}>
          Institutions hidden in Sumurai
        </h3>
        <p className={cn(uiTypographyRecipes.body, semanticTextRecipes.body, 'mx-auto max-w-lg')}>
          Your SimpleFIN bridge may still include these institutions. Sumurai stops syncing them
          until you show them again.
        </p>
      </div>

      <ul className="space-y-3">
        {institutions.map((institution) => {
          const label = formatIgnoredInstitutionLabel(
            institution.org_conn_id,
            institution.institution_name
          );
          const isRestoring = restoringOrgConnId === institution.org_conn_id;

          return (
            <li key={institution.org_conn_id}>
              <GlassCard
                padding="sm"
                withInnerEffects={false}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-left">
                  <p className={cn(uiTypographyRecipes.cardTitle, semanticTextRecipes.primary)}>
                    {label}
                  </p>
                  <p className={cn(uiTypographyRecipes.caption, semanticTextRecipes.muted)}>
                    {formatHiddenAt(institution.hidden_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!isOnline || isRestoring}
                  onClick={() => void onRestore(institution.org_conn_id)}
                  className="shrink-0"
                >
                  <RotateCcw className={cn('h-4 w-4', isRestoring && 'animate-spin')} />
                  {isRestoring ? 'Restoring...' : 'Show again'}
                </Button>
              </GlassCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
