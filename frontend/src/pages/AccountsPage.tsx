import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { Toast } from '../components/Toast'
import ConnectionsList from '../features/plaid/components/ConnectionsList'
import ConnectButton from '../features/plaid/components/ConnectButton'
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow'

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

  const banks = useMemo(() => connections.map(conn => ({
    id: conn.connectionId,
    name: conn.institutionName,
    short: conn.institutionName.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    status: conn.isConnected ? 'connected' as const : 'error' as const,
    lastSync: conn.lastSyncAt,
    accounts: conn.accounts,
  })), [connections])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Accounts</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage your connected accounts and sync transactions.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {banks.length > 0 && (
            <button
              onClick={syncAll}
              disabled={syncingAll}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium whitespace-nowrap shadow-sm ${
                syncingAll
                  ? 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing...' : 'Sync all'}
            </button>
          )}
          <ConnectButton onClick={connect} />
        </div>
      </div>

      <ConnectionsList banks={banks} onConnect={connect} onSync={syncOne} onDisconnect={disconnect} />

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <div className="mt-6 text-xs text-slate-500 dark:text-slate-500">
        Sumaura — Powered by Plaid (12 demo + real accounts)
      </div>
    </div>
  )
}

export default AccountsPage
