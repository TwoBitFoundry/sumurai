import { Link2 } from 'lucide-react'
import ConnectButton from './ConnectButton'
import { BankCard } from '../../../components/BankCard'

export interface BankAccount {
  id: string
  name: string
  mask: string
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
  balance?: number
  transactions?: number
}

export interface BankConnectionViewModel {
  id: string
  name: string
  short: string
  status: 'connected' | 'needs_reauth' | 'error'
  lastSync?: string | null
  accounts: BankAccount[]
}

interface ConnectionsListProps {
  banks: BankConnectionViewModel[]
  onConnect: () => void
  onSync: (id: string) => Promise<void>
  onDisconnect: (id: string) => Promise<void>
}

const ConnectionsList = ({ banks, onConnect, onSync, onDisconnect }: ConnectionsListProps) => {
  if (!banks.length) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/40 dark:bg-slate-800/40 p-10 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-200/60 dark:bg-slate-700/60">
          <Link2 className="h-6 w-6 text-slate-500 dark:text-slate-300" />
        </div>
        <h3 className="text-slate-900 dark:text-slate-100 font-semibold">No accounts connected yet</h3>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Connect an account to start syncing transactions.</p>
        <ConnectButton variant="secondary" onClick={onConnect} className="mt-4" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {banks.map((bank) => (
        <BankCard key={bank.id} bank={bank} onSync={onSync} onDisconnect={onDisconnect} />
      ))}
    </div>
  )
}

export default ConnectionsList
