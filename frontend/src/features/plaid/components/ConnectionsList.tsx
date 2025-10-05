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
      <div className="relative overflow-hidden rounded-[2.25rem] border border-dashed border-[#93c5fd]/65 bg-white/85 px-8 py-12 text-center shadow-[0_26px_80px_-45px_rgba(15,23,42,0.55)] transition-colors duration-300 ease-out dark:border-[#38bdf8]/55 dark:bg-[#0f172a]/82 dark:shadow-[0_32px_90px_-46px_rgba(2,6,23,0.78)]">
        <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-[radial-gradient(120%_140%_at_12%_-10%,rgba(14,165,233,0.18)_0%,rgba(167,139,250,0.16)_42%,transparent_72%)] opacity-80 dark:bg-[radial-gradient(120%_140%_at_18%_-12%,rgba(56,189,248,0.26)_0%,rgba(167,139,250,0.22)_40%,transparent_80%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-[radial-gradient(130%_170%_at_82%_115%,rgba(14,165,233,0.18)_0%,rgba(167,139,250,0.16)_45%,rgba(251,191,36,0.12)_68%,transparent_82%)] opacity-70 dark:bg-[radial-gradient(130%_170%_at_86%_118%,rgba(38,198,218,0.28)_0%,rgba(167,139,250,0.22)_38%,rgba(248,113,113,0.18)_60%,transparent_82%)]" />

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
