import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw, Building2, CreditCard, Clock } from 'lucide-react'
import { Toast } from '../components/Toast'
import ConnectionsList from '../features/plaid/components/ConnectionsList'
import ConnectButton from '../features/plaid/components/ConnectButton'
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow'
import { useTellerLinkFlow } from '../hooks/useTellerLinkFlow'
import { useTellerProviderInfo } from '../hooks/useTellerProviderInfo'
import HeroStatCard from '../components/widgets/HeroStatCard'
import type { FinancialProvider } from '../types/api'
import { getProviderCardConfig } from '@/utils/providerCards'
import { PageLayout } from '../layouts/PageLayout'
import { cn } from '@/ui/primitives'

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
  const providerInfo = useTellerProviderInfo()
  const selectedProvider = providerInfo.selectedProvider
  const providerLoading = providerInfo.loading
  const providerError = providerInfo.error
  const [selectingProvider, setSelectingProvider] = useState<string | null>(null)

  useEffect(() => {
    if (providerError) {
      onError?.(providerError)
    } else if (!providerLoading && selectedProvider) {
      onError?.(null)
    }
  }, [onError, providerError, providerLoading, selectedProvider])

  const plaidFlow = usePlaidLinkFlow({ onError, enabled: selectedProvider === 'plaid' })
  const tellerFlow = useTellerLinkFlow({
    applicationId: providerInfo.tellerApplicationId,
    environment: providerInfo.tellerEnvironment,
    onError,
    enabled: selectedProvider === 'teller'
  })

  const flow = selectedProvider === 'teller' ? tellerFlow : plaidFlow

  const {
    connections,
    toast,
    setToast,
    connect,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
    loading: flowLoading,
    error: flowError,
  } = flow

  const handleProviderSelect = useCallback(async (provider: FinancialProvider) => {
    setSelectingProvider(provider)
    try {
      await providerInfo.chooseProvider(provider)
    } catch (err) {
      console.warn('Failed to select provider', err)
      onError?.('Failed to select provider')
    } finally {
      setSelectingProvider(null)
    }
  }, [onError, providerInfo])

  const banks = useMemo(
    () =>
      (connections || []).map(conn => ({
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

  if (providerLoading) {
    return (
      <section className={cn('relative', 'overflow-hidden', 'rounded-[2.25rem]', 'border', 'border-white/35', 'bg-white/24', 'p-12', 'text-center', 'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]', 'backdrop-blur-[28px]', 'dark:border-white/12', 'dark:bg-[#0f172a]/55', 'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]')}>
        <div className={cn('text-sm', 'font-medium', 'text-slate-600', 'dark:text-slate-300')}>Loading provider catalogue…</div>
      </section>
    )
  }

  if (providerError) {
    return (
      <section className={cn('relative', 'overflow-hidden', 'rounded-[2.25rem]', 'border', 'border-red-200/70', 'bg-red-50/80', 'p-12', 'text-center', 'shadow-[0_32px_110px_-60px_rgba(220,38,38,0.45)]', 'backdrop-blur-[28px]', 'dark:border-red-700/60', 'dark:bg-red-900/25')}>
        <div className={cn('text-sm', 'font-semibold', 'text-red-600', 'dark:text-red-300')}>{providerError}</div>
        <div className={cn('mt-2', 'text-xs', 'text-red-500', 'dark:text-red-200')}>Please refresh or try again later.</div>
      </section>
    )
  }

  if (!selectedProvider) {
    return (
      <section className={cn('relative', 'overflow-hidden', 'rounded-[2.25rem]', 'border', 'border-white/35', 'bg-white/24', 'p-10', 'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]', 'backdrop-blur-[28px]', 'dark:border-white/12', 'dark:bg-[#0f172a]/55', 'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]')}>
        <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-8')}>
          <div className={cn('space-y-3', 'text-center')}>
            <span className={cn('inline-flex', 'items-center', 'justify-center', 'rounded-full', 'bg-white/75', 'px-3', 'py-1', 'text-[11px]', 'font-semibold', 'uppercase', 'tracking-[0.32em]', 'text-[#475569]', 'shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)]', 'dark:bg-[#1e293b]/75', 'dark:text-[#cbd5e1]')}>
              Select Provider
            </span>
            <h1 className={cn('text-3xl', 'font-bold', 'tracking-tight', 'text-slate-900', 'dark:text-white', 'sm:text-4xl')}>
              Choose how you connect accounts
            </h1>
            <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
              Pick the data provider that matches your deployment. You can change this later from account settings.
            </p>
          </div>

          <div className={cn('grid', 'gap-6', 'lg:grid-cols-2')}>
            {providerInfo.availableProviders.map(provider => {
              const details = getProviderCardConfig(provider)
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => handleProviderSelect(provider)}
                  disabled={selectingProvider === provider}
                  className={cn('relative', 'flex', 'h-full', 'flex-col', 'gap-4', 'rounded-[1.75rem]', 'border', 'border-white/45', 'bg-white/80', 'p-6', 'text-left', 'transition-all', 'duration-200', 'hover:-translate-y-[2px]', 'hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)]', 'focus:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-sky-400/80', 'focus-visible:ring-offset-2', 'focus-visible:ring-offset-white', 'disabled:cursor-not-allowed', 'disabled:opacity-75', 'dark:border-white/10', 'dark:bg-[#111a2f]/85', 'dark:hover:border-sky-400/40', 'dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)]', 'dark:focus-visible:ring-offset-[#0f172a]')}
                >
                  <div className={cn('flex', 'items-center', 'justify-between')}>
                    <div className={cn('text-lg', 'font-semibold', 'text-slate-900', 'dark:text-white')}>{details.title}</div>
                    <span className={cn('rounded-full', 'bg-sky-100', 'px-3', 'py-1', 'text-[10px]', 'font-semibold', 'uppercase', 'tracking-[0.28em]', 'text-sky-700', 'dark:bg-sky-500/15', 'dark:text-sky-200')}>
                      {details.badge}
                    </span>
                  </div>
                  <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>{details.description}</p>
                  <ul className={cn('space-y-2', 'text-sm', 'text-slate-500', 'dark:text-slate-400')}>
                    {details.bullets.map(bullet => (
                      <li key={bullet} className={cn('flex', 'items-start', 'gap-2')}>
                        <span className={cn('mt-[5px]', 'h-1.5', 'w-1.5', 'rounded-full', 'bg-sky-400', 'dark:bg-sky-500')} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={cn('mt-auto', 'inline-flex', 'items-center', 'justify-center', 'rounded-full', 'bg-sky-500', 'px-4', 'py-2', 'text-sm', 'font-semibold', 'text-white', 'shadow-[0_18px_48px_-32px_rgba(14,165,233,0.65)]')}>
                    {selectingProvider === provider ? 'Selecting…' : `Use ${details.title}`}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const providerCardConfig = getProviderCardConfig(selectedProvider)
  const providerLabel = providerCardConfig.title
  const providerDescription = selectedProvider === 'plaid'
    ? 'Securely connect institutions with Plaid. Your credentials never touch Sumaura and you can revoke access at any time.'
    : 'Launch Teller Connect to link accounts using your own Teller credentials. Connections stay in your control and can be revoked instantly.'

  const syncFooter = selectedProvider === 'plaid'
    ? 'Plaid keeps credentials read-only and disconnectable anytime.'
    : 'Teller connections respect your API keys and can be rotated from your Teller dashboard.'

  const connectDisabled = flowLoading || selectingProvider !== null || (selectedProvider === 'teller' && !providerInfo.tellerApplicationId)

  const hasConnections = summary.institutions > 0
  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : flowLoading
      ? 'Loading...'
      : summary.latestSync
      ? formatRelativeTime(summary.latestSync)
      : 'Awaiting first sync'
  const lastSyncDetail = summary.latestSync
    ? `Refreshed ${formatAbsoluteTime(summary.latestSync)}`
    : syncFooter

  const syncButtonClasses =
    'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900'

  const pendingInstitutions = Math.max(0, summary.institutions - summary.connectedInstitutions)

  const actions = (
    <>
      {hasConnections && (
        <button
          onClick={syncAll}
          disabled={syncingAll || flowLoading}
          className={syncButtonClasses}
        >
          <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Syncing...' : 'Sync all'}
        </button>
      )}
      <ConnectButton onClick={connect} disabled={connectDisabled}>
        {selectedProvider === 'teller' ? 'Launch Teller Connect' : 'Add account'}
      </ConnectButton>
    </>
  )

  const statsGrid = (
    <div className={cn('grid', 'gap-3', 'sm:grid-cols-3')}>
      {flowError && (
        <div className={cn('sm:col-span-3', 'rounded-2xl', 'border', 'border-red-200/70', 'bg-red-50/80', 'px-5', 'py-3', 'text-left', 'shadow-sm', 'dark:border-red-700/60', 'dark:bg-red-900/25')}>
          <div className={cn('text-sm', 'font-medium', 'text-red-600', 'dark:text-red-300')}>{flowError}</div>
        </div>
      )}

            <HeroStatCard
              index={1}
              title="Active institutions"
              icon={<Building2 className={cn('h-4', 'w-4')} />}
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
              icon={<CreditCard className={cn('h-4', 'w-4')} />}
              value={summary.accounts}
              suffix={summary.accounts === 1 ? 'account' : 'accounts'}
              subtext={summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing'}
            />

      <HeroStatCard
        index={3}
        title="Last sync"
        icon={<Clock className={cn('h-4', 'w-4')} />}
        value={lastSyncValue}
        subtext={syncingAll ? 'Sync in progress' : lastSyncDetail}
      />
    </div>
  )

  return (
    <div data-testid="accounts-page">
    <PageLayout
      badge={`${providerLabel} Accounts`}
      title="Link banks and keep balances current"
      subtitle={providerDescription}
      actions={actions}
      stats={statsGrid}
    >
      <ConnectionsList banks={banks} onConnect={connect} onSync={syncOne} onDisconnect={disconnect} />

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </PageLayout>
    </div>
  )
}

export default AccountsPage
