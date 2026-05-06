import { Building2, Clock, CreditCard } from 'lucide-react';
import { cn } from '@/ui/primitives';
import HeroStatCard from '../../../components/widgets/HeroStatCard';

interface AccountsSummaryStatsProps {
  flowError: string | null;
  summary: {
    institutions: number;
    connectedInstitutions: number;
    accounts: number;
    latestSync: string | null;
  };
  syncingAll: boolean;
  lastSyncValue: string;
  lastSyncDetail: string;
}

export const AccountsSummaryStats = ({
  flowError,
  summary,
  syncingAll,
  lastSyncValue,
  lastSyncDetail,
}: AccountsSummaryStatsProps) => {
  const pendingInstitutions = Math.max(0, summary.institutions - summary.connectedInstitutions);
  const hasConnections = summary.institutions > 0;

  return (
    <div className={cn('grid', 'gap-3', 'sm:grid-cols-3')}>
      {flowError && (
        <div
          className={cn(
            'sm:col-span-3',
            'rounded-2xl',
            'border',
            'border-red-200/70',
            'bg-red-50/80',
            'px-5',
            'py-3',
            'text-left',
            'shadow-sm',
            'dark:border-red-700/60',
            'dark:bg-red-900/25'
          )}
          data-testid="accounts-flow-error"
        >
          <div className={cn('text-sm', 'font-medium', 'text-red-600', 'dark:text-red-300')}>
            {flowError}
          </div>
        </div>
      )}

      <HeroStatCard
        index={1}
        title="Active institutions"
        icon={<Building2 className={cn('h-4', 'w-4')} />}
        value={hasConnections ? summary.connectedInstitutions : 0}
        suffix={`out of ${summary.institutions}`}
        subtext={
          hasConnections
            ? summary.connectedInstitutions === summary.institutions
              ? 'All connections healthy'
              : `${pendingInstitutions} ${pendingInstitutions === 1 ? 'needs' : 'need'} attention`
            : 'Link your first institution'
        }
      />

      <HeroStatCard
        index={2}
        title="Accounts tracked"
        icon={<CreditCard className={cn('h-4', 'w-4')} />}
        value={summary.accounts}
        suffix={summary.accounts === 1 ? 'account' : 'accounts'}
        subtext={
          summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing'
        }
      />

      <HeroStatCard
        index={3}
        title="Last sync"
        icon={<Clock className={cn('h-4', 'w-4')} />}
        value={lastSyncValue}
        subtext={syncingAll ? 'Sync in progress' : lastSyncDetail}
      />
    </div>
  );
};

export default AccountsSummaryStats;
