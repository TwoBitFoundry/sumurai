import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { Toast } from '../components/Toast'
import ConnectionsList from '../features/plaid/components/ConnectionsList'
import ConnectButton from '../features/plaid/components/ConnectButton'
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow'

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

  const statTiles = [
    {
      label: 'Active institutions',
      value: hasConnections ? `${summary.connectedInstitutions}/${summary.institutions}` : '0',
      detail: hasConnections
        ? summary.connectedInstitutions === summary.institutions
          ? 'All connections healthy'
          : `${pendingInstitutions} ${pendingInstitutions === 1 ? 'needs' : 'need'} attention`
        : 'Link your first institution',
      gradient: 'from-[#38bdf8]/25 via-[#0ea5e9]/10 to-transparent',
      ring: 'ring-[#93c5fd]/40',
      border: 'border-sky-300 dark:border-sky-600',
      hoverBorder: 'hover:border-sky-400 dark:hover:border-sky-500',
    },
    {
      label: 'Accounts tracked',
      value: summary.accounts.toLocaleString(),
      detail: summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing',
      gradient: 'from-[#34d399]/28 via-[#10b981]/12 to-transparent',
      ring: 'ring-[#34d399]/35',
      border: 'border-emerald-300 dark:border-emerald-600',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500',
    },
    {
      label: 'Last sync',
      value: lastSyncValue,
      detail: syncingAll ? 'Sync in progress' : lastSyncDetail,
      gradient: 'from-[#a78bfa]/28 via-[#7c3aed]/12 to-transparent',
      ring: 'ring-[#a78bfa]/35',
      border: 'border-violet-300 dark:border-violet-600',
      hoverBorder: 'hover:border-violet-400 dark:hover:border-violet-500',
    },
  ] as const

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-6 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)] sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.25rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
          <div className="absolute inset-0 rounded-[2.25rem] bg-gradient-to-b from-white/72 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#475569] shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-[#cbd5e1]">
                Accounts
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white md:text-[2.6rem]">
                  Link banks and keep balances current
                </h1>
                <p className="text-base leading-relaxed text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
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

          <div className="grid gap-4 sm:grid-cols-3">
            {statTiles.map(({ label, value, detail, gradient, ring, border, hoverBorder }) => (
              <div
                key={label}
                className={`group relative overflow-hidden rounded-[1.8rem] border bg-white/85 px-5 py-4 text-[#0f172a] shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)] transition-all duration-300 ease-out dark:bg-[#0f172a]/82 dark:text-white ${border} ${hoverBorder}`}
              >
                <div className={`pointer-events-none absolute inset-0 rounded-[1.8rem] bg-gradient-to-br ${gradient} opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100`} />
                <div className={`pointer-events-none absolute inset-[2px] rounded-[1.65rem] ring-1 ${ring} opacity-70`} />
                <div className="relative z-10 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">
                    {label}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
                    {value}
                  </p>
                  <p className="text-xs text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
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
