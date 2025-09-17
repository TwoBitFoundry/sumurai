import React from 'react'

interface MockDataStepProps {
  selectedOption: boolean | null
  onOptionSelect: (enableMockData: boolean) => void
}

export function MockDataStep({ selectedOption, onOptionSelect }: MockDataStepProps) {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Choose Your Experience
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Would you like to start with sample data to explore the features, or connect
          your real bank account right away?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <button
          onClick={() => onOptionSelect(true)}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg ${
            selectedOption === true
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎭</div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Demo Mode
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Start with sample transactions and accounts to explore all features
              without connecting your bank.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>Pre-populated transactions</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>Sample budgets and analytics</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>No real financial data required</span>
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => onOptionSelect(false)}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg ${
            selectedOption === false
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏦</div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Real Data
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Connect your bank account to start tracking your actual financial data
              and transactions.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>Live transaction sync</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>Real account balances</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>✓</span>
                <span>Accurate spending insights</span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {selectedOption !== null && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
          <p className="text-sm text-green-800 dark:text-green-300">
            {selectedOption
              ? '🎭 Demo mode selected. You can always connect real accounts later.'
              : '🏦 Real data mode selected. You\'ll connect your bank in the next step.'
            }
          </p>
        </div>
      )}
    </div>
  )
}