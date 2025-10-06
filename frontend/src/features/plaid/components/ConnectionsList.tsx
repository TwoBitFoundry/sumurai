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
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/20 px-8 py-12 text-center shadow-[0_32px_110px_-62px_rgba(15,23,42,0.72)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-64px_rgba(2,6,23,0.82)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
          <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/65 via-white/24 to-transparent transition-colors duration-500 dark:from-slate-900/66 dark:via-slate-900/32 dark:to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-[#0ea5e9] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] ring-1 ring-white/55 dark:bg-[#1e293b]/80 dark:text-[#38bdf8] dark:ring-white/10">
            <Link2 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-[#0f172a] dark:text-white">No accounts connected yet</h3>
            <p className="text-sm text-[#475569] dark:text-[#cbd5e1]">
              Add your first institution to unlock live balances and automated transaction sync.
            </p>
          </div>
          <ConnectButton onClick={onConnect} className="mt-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {banks.map(bank => (
        <BankCard key={bank.id} bank={bank} onSync={onSync} onDisconnect={onDisconnect} />
      ))}
    </div>
  )
}

export default ConnectionsList
