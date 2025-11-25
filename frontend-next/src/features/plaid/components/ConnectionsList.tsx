import { Link2 } from 'lucide-react'
import ConnectButton from './ConnectButton'
import { BankCard } from '../../../components/BankCard'
import { EmptyState } from '@/ui/primitives'

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
      <EmptyState
        icon={Link2}
        title="No accounts connected yet"
        description="Add your first institution to unlock live balances and automated transaction sync."
        action={<ConnectButton onClick={onConnect} />}
      />
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