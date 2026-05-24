import { Building2, Clock, CreditCard } from 'lucide-react';
import { cn } from '@/ui/primitives';
import HeroStatCard from '../../../components/widgets/HeroStatCard';

interface AccountsSummaryStatsProps {
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
  summary,
  syncingAll,
  lastSyncValue,
  lastSyncDetail,
}: AccountsSummaryStatsProps) => {
  const pendingInstitutions = Math.max(0, summary.institutions - summary.connectedInstitutions);
  const hasConnections = summary.institutions > 0;

  return (
    <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-3')}>
      <HeroStatCard
        index={1}
        title="Active institutions"
        icon={<Building2 />}
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
        icon={<CreditCard />}
        value={summary.accounts}
        suffix={summary.accounts === 1 ? 'account' : 'accounts'}
        subtext={
          summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing'
        }
      />

      <HeroStatCard
        index={3}
        title="Last sync"
        icon={<Clock />}
        value={lastSyncValue}
        subtext={syncingAll ? 'Sync in progress' : lastSyncDetail}
      />
    </div>
  );
};

export default AccountsSummaryStats;
