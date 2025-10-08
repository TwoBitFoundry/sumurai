import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw, Building2, CreditCard, Clock } from 'lucide-react'
import { Toast } from '../components/Toast'
import ConnectionsList from '../features/plaid/components/ConnectionsList'
import ConnectButton from '../features/plaid/components/ConnectButton'
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow'
import HeroStatCard from '../components/widgets/HeroStatCard'

const formatRelativeTime = (iso: string): string => {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'Unknown'
  }

  const now = Date.now()
  const diff = Math.max(0, now - timestamp)

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day

  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.round(diff / minute)}m ago`
  if (diff < day) return `${Math.round(diff / hour)}h ago`
  if (diff < month) return `${Math.round(diff / day)}d ago`
  if (diff < year) return `${Math.round(diff / month)}mo ago`
  return `${Math.round(diff / year)}y ago`
}

const formatAbsoluteTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown timestamp'
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface AccountsPageProps {
  onError?: (message: string | null) => void
}

const AccountsPage = ({ onError }: AccountsPageProps) => {
  const {
    connections,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
  } = usePlaidLinkFlow({ onError })

  const banks = useMemo(
    () =>
      connections.map(conn => ({
        id: conn.connectionId,
        name: conn.institutionName,
        short: conn.institutionName.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
        status: conn.isConnected ? ('connected' as const) : ('error' as const),
        lastSync: conn.lastSyncAt,
        accounts: conn.accounts,
      })),
    [connections],
  )

  const summary = useMemo(() => {
    let connectedInstitutions = 0
    let totalAccounts = 0
    let latestSyncIso: string | null = null
    let latestSyncTime = 0

    for (const bank of banks) {
      if (bank.status === 'connected') connectedInstitutions += 1
      totalAccounts += bank.accounts.length

      if (bank.lastSync) {
        const parsed = Date.parse(bank.lastSync)
        if (!Number.isNaN(parsed) && parsed > latestSyncTime) {
          latestSyncTime = parsed
          latestSyncIso = bank.lastSync
        }
      }
    }

    return {
      institutions: banks.length,
      connectedInstitutions,
      accounts: totalAccounts,
      latestSync: latestSyncIso,
    }
  }, [banks])

  const hasConnections = summary.institutions > 0
  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : summary.latestSync
      ? formatRelativeTime(summary.latestSync)
      : 'Awaiting first sync'
  const lastSyncDetail = summary.latestSync
    ? `Refreshed ${formatAbsoluteTime(summary.latestSync)}`
    : 'Plaid keeps credentials read-only and disconnectable anytime.'

  const syncButtonClasses =
    'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900'

  const pendingInstitutions = Math.max(0, summary.institutions - summary.connectedInstitutions)

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-8 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)] sm:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
          <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/72 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#475569] shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-[#cbd5e1]">
                Accounts
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl">
                  Link banks and keep balances current
                </h1>
                <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
                  Securely connect institutions with Plaid. Your credentials never touch Sumaura and
                  you control access with a single click.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3">
              {hasConnections && (
                <button
                  onClick={syncAll}
                  disabled={syncingAll}
                  className={syncButtonClasses}
                >
                  <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
                  {syncingAll ? 'Syncing...' : 'Sync all'}
                </button>
              )}
              <ConnectButton onClick={connect} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroStatCard
              index={1}
              title="Active institutions"
              icon={<Building2 className="h-4 w-4" />}
              value={hasConnections ? summary.connectedInstitutions : 0}
              suffix={`out of ${summary.institutions}`}
              subtext={hasConnections
                ? (summary.connectedInstitutions === summary.institutions
                    ? 'All connections healthy'
                    : `${pendingInstitutions} ${pendingInstitutions === 1 ? 'needs' : 'need'} attention`)
                : 'Link your first institution'}
            />

            <HeroStatCard
              index={2}
              title="Accounts tracked"
              icon={<CreditCard className="h-4 w-4" />}
              value={summary.accounts}
              suffix={summary.accounts === 1 ? 'account' : 'accounts'}
              subtext={summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing'}
            />

            <HeroStatCard
              index={3}
              title="Last sync"
              icon={<Clock className="h-4 w-4" />}
              value={lastSyncValue}
              subtext={syncingAll ? 'Sync in progress' : lastSyncDetail}
            />
          </div>
        </div>
      </section>

      <ConnectionsList banks={banks} onConnect={connect} onSync={syncOne} onDisconnect={disconnect} />

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default AccountsPage
