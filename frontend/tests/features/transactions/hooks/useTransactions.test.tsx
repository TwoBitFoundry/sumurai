import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ReactNode } from 'react'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { TransactionService } from '@/services/TransactionService'
import { PlaidService } from '@/services/PlaidService'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'

vi.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactions: vi.fn(),
  }
}))

vi.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: vi.fn(),
    getStatus: vi.fn(),
  }
}))

const asTransaction = (id: string, date = '2024-02-10') => ({
  id,
  date,
  name: 'Transaction',
  merchant: 'Store',
  amount: 100,
  category: { id: 'groceries', name: 'Groceries' },
  account_name: 'Checking',
  account_type: 'depository',
  account_mask: '1234',
})

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>
    {children}
  </AccountFilterProvider>
)

describe('useTransactions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(TransactionService.getTransactions).mockResolvedValue([])
    vi.mocked(PlaidService.getAccounts).mockResolvedValue([] as any)
    vi.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1'
    } as any)
  })

  it('should refetch transactions when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    // Mock transactions response
    vi.mocked(TransactionService.getTransactions).mockResolvedValue([
      asTransaction('t1'),
      asTransaction('t2'),
    ] as any)

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useTransactions()
    }, { wrapper: TestWrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1)
    })

    // Verify initial call was made without account filter (all accounts)
    expect(TransactionService.getTransactions).toHaveBeenLastCalledWith({})

    // Clear the mock to track new calls
    vi.mocked(TransactionService.getTransactions).mockClear()

    // Change account filter to specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch with account filter
    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({
        accountIds: ['account1', 'account2']
      })
    })
  })

  it('should reset pagination when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    // Mock a large set of transactions
    const transactions = Array.from({ length: 25 }, (_, i) => asTransaction(`t${i + 1}`))
    vi.mocked(TransactionService.getTransactions).mockResolvedValue(transactions as any)

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useTransactions({ pageSize: 10 })
    }, { wrapper: TestWrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.transactions).toHaveLength(25)
    })

    // Navigate to page 2
    await act(async () => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.currentPage).toBe(2)

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Pagination should reset to page 1
    await waitFor(() => {
      expect(result.current.currentPage).toBe(1)
    })
  })

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    vi.mocked(TransactionService.getTransactions).mockResolvedValue([asTransaction('t1')] as any)

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useTransactions()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1)
    })

    // Clear mock and set specific accounts
    vi.mocked(TransactionService.getTransactions).mockClear()

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({
        accountIds: ['account1', 'account2']
      })
    })
  })

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    vi.mocked(TransactionService.getTransactions).mockResolvedValue([asTransaction('t1')] as any)

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useTransactions()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1)
    })

    // Clear mock and ensure all accounts is selected
    vi.mocked(TransactionService.getTransactions).mockClear()

    await act(async () => {
      accountFilterHook!.selectAllAccounts()
    })

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({})
    })
  })
})
