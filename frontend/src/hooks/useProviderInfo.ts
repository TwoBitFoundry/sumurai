import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FinancialProvider } from '../types/api'
import { ApiClient } from '../services/ApiClient'

export interface ProviderCatalogue {
  available_providers: FinancialProvider[]
  default_provider: FinancialProvider
  user_provider?: FinancialProvider
  teller_application_id?: string
}

export interface ProviderSelectionResult {
  user_provider: FinancialProvider
}

export interface ProviderGateway {
  fetchInfo: () => Promise<ProviderCatalogue>
  selectProvider: (provider: FinancialProvider) => Promise<ProviderSelectionResult>
}

const apiGateway: ProviderGateway = {
  async fetchInfo() {
    return ApiClient.get<ProviderCatalogue>('/providers/info')
  },
  async selectProvider(provider) {
    return ApiClient.post<ProviderSelectionResult>('/providers/select', { provider })
  }
}

export interface UseProviderInfoOptions {
  gateway?: ProviderGateway
}

export interface ProviderInfoState {
  loading: boolean
  error: string | null
  availableProviders: FinancialProvider[]
  selectedProvider: FinancialProvider | null
  defaultProvider: FinancialProvider | null
  userProvider: FinancialProvider | null
  tellerApplicationId: string | null
  refresh: () => Promise<void>
  chooseProvider: (provider: FinancialProvider) => Promise<void>
}

const emptyProviders: FinancialProvider[] = []

export function useProviderInfo(options: UseProviderInfoOptions = {}): ProviderInfoState {
  const gateway = options.gateway ?? apiGateway
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<ProviderCatalogue | null>(null)

  const selectedProvider = useMemo<FinancialProvider | null>(() => {
    if (!catalogue) {
      return null
    }
    return catalogue.user_provider ?? catalogue.default_provider ?? null
  }, [catalogue])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const info = await gateway.fetchInfo()
      setCatalogue(info)
    } catch (err) {
      console.warn('Failed to fetch provider information', err)
      setError('Unable to load provider information')
      setCatalogue(null)
    } finally {
      setLoading(false)
    }
  }, [gateway])

  const chooseProvider = useCallback(async (provider: FinancialProvider) => {
    try {
      const result = await gateway.selectProvider(provider)
      setCatalogue(prev => {
        if (!prev) {
          return {
            available_providers: [result.user_provider],
            default_provider: result.user_provider,
            user_provider: result.user_provider
          }
        }
        return {
          ...prev,
          user_provider: result.user_provider
        }
      })
    } catch (err) {
      console.warn('Failed to select provider', err)
      setError('Unable to select provider right now')
      throw err
    }
  }, [gateway])

  useEffect(() => {
    load()
  }, [load])

  return {
    loading,
    error,
    availableProviders: catalogue?.available_providers ?? emptyProviders,
    selectedProvider,
    defaultProvider: catalogue?.default_provider ?? null,
    userProvider: catalogue?.user_provider ?? null,
    tellerApplicationId: catalogue?.teller_application_id ?? null,
    refresh: load,
    chooseProvider
  }
}
