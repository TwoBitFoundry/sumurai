import { useEffect } from 'react'
import { useProviderInfo } from '../hooks/useProviderInfo'
import { ProviderMismatchModal } from './ProviderMismatchModal'

interface ProviderMismatchCheckProps {
  showMismatch: boolean
  onShowMismatch: (show: boolean) => void
  onConfirm: () => void
}

export const ProviderMismatchCheck = ({ showMismatch, onShowMismatch, onConfirm }: ProviderMismatchCheckProps) => {
  const providerInfo = useProviderInfo()

  useEffect(() => {
    if (providerInfo.loading) {
      return
    }

    if (!providerInfo.userProvider || !providerInfo.defaultProvider) {
      return
    }

    console.log('Provider check:', {
      userProvider: providerInfo.userProvider,
      defaultProvider: providerInfo.defaultProvider,
      match: providerInfo.userProvider === providerInfo.defaultProvider
    })

    if (providerInfo.userProvider !== providerInfo.defaultProvider) {
      console.log('Provider mismatch detected! Showing modal...')
      onShowMismatch(true)
    }
  }, [providerInfo.loading, providerInfo.userProvider, providerInfo.defaultProvider, onShowMismatch])

  if (!showMismatch || !providerInfo.userProvider || !providerInfo.defaultProvider) {
    return null
  }

  return (
    <ProviderMismatchModal
      userProvider={providerInfo.userProvider}
      defaultProvider={providerInfo.defaultProvider}
      onConfirm={onConfirm}
    />
  )
}
