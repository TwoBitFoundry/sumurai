import React from 'react'

interface ConnectAccountStepProps {
  isConnected: boolean
  connectionInProgress: boolean
  institutionName: string | null
  error: string | null
  onConnect: () => void
  onRetry: () => void
}

export function ConnectAccountStep({
  isConnected,
  connectionInProgress,
  institutionName,
  error,
  onConnect,
  onRetry,
}: ConnectAccountStepProps) {

  if (isConnected) {
    return (
      <div className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Connected Successfully!
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Your {institutionName} account has been connected. Your transactions will sync automatically.
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {institutionName} Connected
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Your account data is secure and will be updated automatically.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Connect Your Bank Account
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Securely connect your bank account to start tracking your real financial data.
          We use Plaid's bank-grade security to protect your information.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-300 font-medium mb-2">Connection Failed</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl mb-2">🔒</div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">Secure</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Bank-level encryption
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">Fast</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Instant connection
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🏦</div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">Compatible</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                11,000+ banks
              </p>
            </div>
          </div>

          <button
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {connectionInProgress ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </span>
            ) : error ? (
              'Try Again'
            ) : (
              'Connect Bank Account'
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p>🔐 We never store your banking credentials</p>
          <p>📊 Your data is encrypted and only used for analytics</p>
          <p>🚫 We cannot initiate transactions or access funds</p>
        </div>
      </div>
    </div>
  )
}