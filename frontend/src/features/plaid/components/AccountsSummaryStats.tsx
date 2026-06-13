import { Building2, ChevronDown, Clock, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import { InsightsExpandablePanel } from '@/components/widgets/InsightsExpandablePanel';
import { InsightsPanelHeader } from '@/components/widgets/InsightsPanel';
import { InsightsPanelShell } from '@/components/widgets/InsightsPanelShell';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface AccountsSummaryStatsProps {
  summary: {
    institutions: number;
    connectedInstitutions: number;
    accounts: number;
    latestSync: string | null;
  };
  lastSyncValue: string;
}

export const AccountsSummaryStats = ({ summary, lastSyncValue }: AccountsSummaryStatsProps) => {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { expanded, toggleExpanded } = useSessionCollapsible('accounts-summary-stats');
  const { isMobile } = useViewportBreakpoint();
  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const hasConnections = summary.institutions > 0;
  const cardAccent = 'violet' as const;
  const insightsToggleLabel = expanded ? 'Collapse account insights' : 'Expand account insights';

  const summaryCards = expanded ? (
    <>
      <InsightCard
        title="Institutions"
        icon={<Building2 />}
        value={
          <>
            <span className="justify-self-start">
              {hasConnections ? summary.connectedInstitutions : 0}
            </span>
            <span
              className={cn(
                uiTypographyRecipes.caption,
                semanticTextRecipes.body,
                'justify-self-center'
              )}
            >
              out of
            </span>
            <span className="justify-self-start">{summary.institutions}</span>
          </>
        }
        question="How many of your linked institutions are currently connected?"
        accent={cardAccent}
        flipped={!!flipped.institutions}
        onToggle={() => toggle('institutions')}
        outlined={false}
        tileLayout={!isMobile}
        tileAlign="start"
        subgridRow={isMobile}
      />
      <InsightCard
        title="Accounts"
        icon={<CreditCard />}
        value={
          <span className="justify-self-start col-span-3">
            {summary.accounts}
            <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-0.5')}>
              {summary.accounts === 1 ? 'account' : 'accounts'}
            </span>
          </span>
        }
        question="How many accounts are you tracking across linked institutions?"
        accent={cardAccent}
        flipped={!!flipped.accounts}
        onToggle={() => toggle('accounts')}
        outlined={false}
        tileLayout={!isMobile}
        tileAlign="center"
        subgridRow={isMobile}
      />
      <InsightCard
        title="Last sync"
        icon={<Clock />}
        value={<span className="justify-self-start col-span-3">{lastSyncValue}</span>}
        question="When did your accounts last sync with the provider?"
        accent={cardAccent}
        flipped={!!flipped['last-sync']}
        onToggle={() => toggle('last-sync')}
        outlined={false}
        tileLayout={!isMobile}
        tileAlign="end"
        subgridRow={isMobile}
      />
    </>
  ) : null;

  return (
    <InsightsPanelShell testId="accounts-summary-shell" accent="violet">
      <InsightsExpandablePanel
        testId="accounts-summary-panel"
        bodyId="accounts-summary-panel-body"
        bodyTestId="accounts-summary-panel-body"
        summaryLabel={insightsToggleLabel}
        expanded={expanded}
        onToggle={toggleExpanded}
        bodyClassName={cn(
          isMobile
            ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
            : 'flex flex-row items-start gap-3'
        )}
        summary={
          <>
            <InsightsPanelHeader label="Account summary" />
            <div className={cn('flex', 'justify-center', 'pt-0.5')}>
              <ChevronDown
                className={cn(
                  'h-4',
                  'w-4',
                  'shrink-0',
                  'transition-transform',
                  'duration-200',
                  expanded && 'rotate-180',
                  'text-slate-500',
                  'dark:text-slate-400'
                )}
              />
            </div>
          </>
        }
      >
        {summaryCards}
      </InsightsExpandablePanel>
    </InsightsPanelShell>
  );
};

export default AccountsSummaryStats;
