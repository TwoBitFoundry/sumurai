import { Building2, Clock, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import { InsightsPanel } from '@/components/widgets/InsightsPanel';
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
  const { isMobile } = useViewportBreakpoint();
  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const hasConnections = summary.institutions > 0;
  const cardAccent = 'violet' as const;

  const summaryCards = (
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
  );

  return (
    <InsightsPanel testId="accounts-summary-shell" accent="violet" headerLabel="Account summary">
      {summaryCards}
    </InsightsPanel>
  );
};

export default AccountsSummaryStats;
