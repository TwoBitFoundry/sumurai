import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ProviderMismatchModalProps {
  userProvider: string
  defaultProvider: string
  onConfirm: () => void
}

export const ProviderMismatchModal = ({ userProvider, defaultProvider, onConfirm }: ProviderMismatchModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const providerLabels: Record<string, string> = {
    plaid: 'Plaid',
    teller: 'Teller'
  }

  const userProviderLabel = providerLabels[userProvider] || userProvider
  const defaultProviderLabel = providerLabels[defaultProvider] || defaultProvider

  useEffect(() => {
    buttonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        buttonRef.current?.focus()
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.relatedTarget as Node)) {
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div ref={modalRef} className="relative z-10 mx-4 w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl dark:border-white/10 dark:bg-slate-900/95">
        <div className="mb-6 flex items-center justify-center">
          <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
        </div>

        <h2 id="modal-title" className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white">
          Provider Configuration Mismatch
        </h2>

        <div className="mb-6 space-y-3 text-center">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Your account is configured to use <span className="font-semibold text-slate-900 dark:text-white">{userProviderLabel}</span>,
            but the application is set to use <span className="font-semibold text-slate-900 dark:text-white">{defaultProviderLabel}</span> by default.
          </p>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Please update your environment configuration to set <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">DEFAULT_PROVIDER={userProvider}</code> and restart the application.
          </p>
        </div>

        <button
          ref={buttonRef}
          onClick={onConfirm}
          className="w-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-sky-600 hover:to-blue-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
