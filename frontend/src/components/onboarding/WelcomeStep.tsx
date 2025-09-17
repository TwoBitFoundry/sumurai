import React from 'react'

export function WelcomeStep() {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Welcome to Sumaura
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Your personal finance dashboard that helps you track expenses, manage budgets,
          and gain insights into your financial health.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Track Spending
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect your bank accounts and automatically categorize transactions
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Manage Budgets
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set spending limits and track your progress towards financial goals
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Get Insights
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Visualize your financial data with charts and analytics
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          🔒 Your financial data is encrypted and secure. We use bank-level security standards.
        </p>
      </div>
    </div>
  )
}