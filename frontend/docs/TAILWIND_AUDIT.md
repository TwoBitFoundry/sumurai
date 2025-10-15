# Tailwind Usage Audit Report

**Generated:** 2025-10-15

## Summary

- **Total Files Scanned:** 88
- **Files with Violations:** 31
- **Total Violations:** 216
- **Compliance Rate:** 64.8%

## Violation Threshold

Files with `className` props exceeding **5 utility classes** are flagged as violations.

### Why This Matters

Long Tailwind `className` strings indicate:
1. Missed opportunities to use existing primitives
2. Code duplication across components
3. Harder to maintain consistent design

### Recommended Actions

- **Extract to primitive:** If pattern is reused 3+ times
- **Compose primitives:** Combine existing primitives instead of inline classes
- **Document exception:** If truly one-off, add ESLint disable comment with reason

---

## Violations by File

### `pages/BudgetsPage.tsx`

**Violations:** 19

- **Line 235** (17 utilities)
  ```tsx
  <div className="group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white/80 p-5 text-slate-700 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-slate-300 dark:border-slate-700 dark:bg-[#111a2f]/70 dark:text-slate-200 dark:hover:border-slate-600">
  ```

- **Line 236** (14 utilities)
  ```tsx
  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/40 via-slate-100/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20" />
  ```

- **Line 237** (6 utilities)
  ```tsx
  <div className="relative z-10 flex items-center justify-between gap-4">
  ```

- **Line 239** (8 utilities)
  ```tsx
  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Total Planned</div>
  ```

- **Line 240** (7 utilities)
  ```tsx
  <div className="mt-1 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{fmtUSD(stats.totalBudgeted)}</div>
  ```

- **Line 243** (8 utilities)
  ```tsx
  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Total Spent</div>
  ```

- **Line 248** (8 utilities)
  ```tsx
  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-300 dark:bg-slate-700/60 dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]">
  ```

- **Line 258** (8 utilities)
  ```tsx
  <div className="flex items-center justify-between text-[0.75rem] text-slate-500 transition-colors duration-300 dark:text-slate-400">
  ```

- **Line 283** (7 utilities)
  ```tsx
  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
  ```

- **Line 289** (24 utilities)
  ```tsx
  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 297** (24 utilities)
  ```tsx
  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 303** (8 utilities)
  ```tsx
  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors duration-500 dark:text-slate-300">
  ```

- **Line 308** (9 utilities)
  ```tsx
  <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors duration-500 dark:text-slate-400">
  ```

- **Line 318** (27 utilities)
  ```tsx
  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#111a2f] dark:text-slate-100 dark:hover:bg-[#0f172a] dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 327** (23 utilities)
  ```tsx
  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 358** (9 utilities)
  ```tsx
  <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center sm:px-12" data-testid="budgets-empty-state">
  ```

- **Line 359** (11 utilities)
  ```tsx
  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/20 via-sky-300/25 to-violet-500/20 text-4xl">
  ```

- **Line 362** (6 utilities)
  ```tsx
  <div className="text-lg font-semibold text-slate-700 transition-colors duration-500 dark:text-slate-200">No budgets found</div>
  ```

- **Line 369** (22 utilities)
  ```tsx
  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
  ```

---

### `features/budgets/components/BudgetList.tsx`

**Violations:** 16

- **Line 30** (18 utilities)
  ```tsx
  <div className="flex flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-slate-200/70 bg-white/90 p-10 text-center text-sm text-slate-500 shadow-[0_32px_80px_-58px_rgba(15,23,42,0.45)] transition-colors duration-300 dark:border-white/10 dark:bg-[#111a2f]/85 dark:text-slate-400 dark:shadow-[0_32px_90px_-60px_rgba(2,6,23,0.65)]">
  ```

- **Line 40** (8 utilities)
  ```tsx
  <ul className="grid grid-cols-1 gap-6 p-6 sm:px-10 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  ```

- **Line 52** (13 utilities)
  ```tsx
  <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:via-white/20" />
  ```

- **Line 68** (19 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 p-2 text-white shadow-[0_18px_45px_-28px_rgba(16,185,129,0.6)] transition-transform duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 76** (23 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/80 p-2 text-slate-600 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/80 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 87** (23 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/80 p-2 text-slate-600 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/80 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 95** (20 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full bg-red-500/15 p-2 text-red-600 shadow-[0_16px_38px_-26px_rgba(248,113,113,0.55)] transition-transform duration-200 hover:-translate-y-[2px] hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/25 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 107** (9 utilities)
  ```tsx
  <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-300 dark:text-slate-400">
  ```

- **Line 117** (21 utilities)
  ```tsx
  className="w-full rounded-2xl border border-white/60 bg-white/90 px-4 py-2 text-base font-semibold text-slate-800 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.55)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#0f172a]/85 dark:text-white dark:focus:ring-offset-[#0f172a]"
  ```

- **Line 120** (6 utilities)
  ```tsx
  <div className="text-right text-sm text-slate-500 transition-colors duration-300 dark:text-slate-400">
  ```

- **Line 121** (9 utilities)
  ```tsx
  <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-300 dark:text-slate-400">Spent</span>
  ```

- **Line 122** (6 utilities)
  ```tsx
  <span className="text-base font-semibold text-slate-700 transition-colors duration-300 dark:text-slate-200">{fmtUSD(b.spent)}</span>
  ```

- **Line 126** (8 utilities)
  ```tsx
  <div className="grid grid-cols-2 gap-4 text-sm text-slate-500 transition-colors duration-300 dark:text-slate-400">
  ```

- **Line 128** (8 utilities)
  ```tsx
  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-300 dark:text-slate-500">Planned</span>
  ```

- **Line 129** (7 utilities)
  ```tsx
  <div className="mt-1 text-2xl font-semibold text-slate-900 transition-colors duration-300 dark:text-white">{fmtUSD(b.amount)}</div>
  ```

- **Line 132** (8 utilities)
  ```tsx
  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-300 dark:text-slate-500">Spent</span>
  ```

---

### `components/onboarding/ConnectAccountStep.tsx`

**Violations:** 14

- **Line 112** (9 utilities)
  ```tsx
  <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white md:text-[2.6rem]">
  ```

- **Line 115** (7 utilities)
  ```tsx
  <p className="text-base leading-relaxed text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 146** (12 utilities)
  ```tsx
  <div className="rounded-2xl border border-[#f87171] bg-[#fef2f2] p-4 text-sm shadow-sm transition-colors duration-300 ease-out animate-[shake_400ms_ease-out,errorPulse_400ms_ease-out] dark:bg-[#450a0a]">
  ```

- **Line 156** (23 utilities)
  ```tsx
  className="group flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8]"
  ```

- **Line 164** (10 utilities)
  ```tsx
  <span className="absolute inset-[20%] rounded-full bg-slate-300/30 opacity-40 blur-[6px] transition-colors duration-300 ease-out dark:bg-black/20" />
  ```

- **Line 170** (8 utilities)
  ```tsx
  <h4 className="mt-3 text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
  ```

- **Line 173** (7 utilities)
  ```tsx
  <p className="mt-1 text-xs text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 182** (14 utilities)
  ```tsx
  <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1] sm:mb-4">
  ```

- **Line 191** (23 utilities)
  ```tsx
  className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4 text-[13px] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8]"
  ```

- **Line 199** (10 utilities)
  ```tsx
  <span className="absolute inset-[18%] rounded-full bg-slate-300/30 opacity-50 blur-[6px] transition-colors duration-300 ease-out dark:bg-black/20" />
  ```

- **Line 206** (7 utilities)
  ```tsx
  <p className="text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
  ```

- **Line 209** (7 utilities)
  ```tsx
  <p className="mt-1 text-[12px] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 234** (8 utilities)
  ```tsx
  <span className="inline-flex h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
  ```

- **Line 243** (6 utilities)
  ```tsx
  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
  ```

---

### `components/onboarding/OnboardingWizard.tsx`

**Violations:** 14

- **Line 165** (9 utilities)
  ```tsx
  <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-500 ease-out">
  ```

- **Line 166** (6 utilities)
  ```tsx
  <div className="pointer-events-none absolute inset-0 transition-colors duration-500 ease-out">
  ```

- **Line 169** (15 utilities)
  ```tsx
  <div className="absolute left-1/2 top-1/2 h-[70rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.22] blur-3xl animate-[rotateAura_90s_linear_infinite] bg-[conic-gradient(from_0deg,#93c5fd_0deg,#34d399_140deg,#fbbf24_240deg,#a78bfa_320deg,#93c5fd_360deg)] transition-all duration-700 ease-out dark:opacity-[0.32] dark:bg-[conic-gradient(from_0deg,#38bdf8_0deg,#34d399_120deg,#a78bfa_210deg,#fbbf24_285deg,#f87171_330deg,#38bdf8_360deg)]" />
  ```

- **Line 171** (11 utilities)
  ```tsx
  <div className="absolute inset-0 transition-colors duration-500 bg-gradient-to-b from-white/65 via-white/40 to-transparent dark:from-slate-900/70 dark:via-slate-900/40 dark:to-transparent" />
  ```

- **Line 180** (8 utilities)
  ```tsx
  <div className="flex-1 flex items-center justify-center p-4 md:p-6 relative z-10">
  ```

- **Line 186** (6 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(15,23,42,0.08)] dark:ring-white/8 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(2,6,23,0.4)]" />
  ```

- **Line 189** (9 utilities)
  ```tsx
  <div className="absolute -left-32 top-16 h-64 w-64 rounded-full bg-[#0ea5e9]/18 blur-3xl dark:bg-[#38bdf8]/18" />
  ```

- **Line 190** (9 utilities)
  ```tsx
  <div className="absolute -right-24 bottom-12 h-56 w-56 rounded-full bg-[#a78bfa]/18 blur-3xl dark:bg-[#a78bfa]/22" />
  ```

- **Line 219** (7 utilities)
  ```tsx
  <span className="h-px w-6 bg-[#e2e8f0] dark:bg-[#334155] transition-colors duration-300 ease-out" aria-hidden="true" />
  ```

- **Line 230** (9 utilities)
  ```tsx
  <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center animate-[fadeSlideUp_400ms_ease-out_200ms_backwards]">
  ```

- **Line 231** (9 utilities)
  ```tsx
  <div className="flex items-center gap-2 text-xs text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 239** (17 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-[#475569] dark:text-[#cbd5e1] transition-all duration-200 ease-out hover:bg-[#f8fafc] dark:hover:bg-[#1e293b] hover:text-[#0f172a] dark:hover:text-white"
  ```

- **Line 248** (22 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] px-5 py-2 text-sm font-medium text-[#475569] dark:text-[#cbd5e1] transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-lg hover:border-[#93c5fd] dark:hover:border-[#38bdf8]"
  ```

- **Line 257** (29 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#a78bfa] px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(14,165,233,0.4)] active:scale-[0.98] active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg dark:focus-visible:ring-offset-slate-900"
  ```

---

### `components/BalancesOverview.tsx`

**Violations:** 13

- **Line 13** (12 utilities)
  ```tsx
  <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 text-xs font-medium">
  ```

- **Line 154** (15 utilities)
  ```tsx
  <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-8 shadow-[0_45px_140px_-80px_rgba(15,23,42,0.82)] backdrop-blur-2xl backdrop-saturate-[160%] transition-colors duration-500 ease-out sm:p-12 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_48px_160px_-82px_rgba(2,6,23,0.85)]">
  ```

- **Line 156** (6 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
  ```

- **Line 157** (12 utilities)
  ```tsx
  <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/70 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
  ```

- **Line 161** (6 utilities)
  ```tsx
  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
  ```

- **Line 163** (14 utilities)
  ```tsx
  <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#475569] shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-[#cbd5e1]">
  ```

- **Line 167** (9 utilities)
  ```tsx
  <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl">
  ```

- **Line 170** (7 utilities)
  ```tsx
  <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
  ```

- **Line 190** (7 utilities)
  ```tsx
  <div key={i} className="h-16 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60" />
  ```

- **Line 196** (13 utilities)
  ```tsx
  <div data-testid="balances-error" className="flex items-center justify-between rounded-xl border border-rose-200/70 dark:border-rose-600/40 bg-rose-50/80 dark:bg-rose-900/25 p-3 text-sm text-rose-700 dark:text-rose-300">
  ```

- **Line 198** (7 utilities)
  ```tsx
  <button onClick={refresh} className="rounded-md bg-rose-600 text-white px-3 py-1 text-xs hover:bg-rose-700">Retry</button>
  ```

- **Line 218** (9 utilities)
  ```tsx
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
  ```

- **Line 219** (16 utilities)
  ```tsx
  <div className="whitespace-nowrap rounded-lg border border-white/55 dark:border-white/10 bg-white/90 dark:bg-[#111a2f]/90 backdrop-blur px-3 py-2 shadow-lg text-xs sm:text-sm flex items-center gap-4">
  ```

---

### `features/transactions/components/TransactionsTable.tsx`

**Violations:** 12

- **Line 34** (6 utilities)
  ```tsx
  <div className="text-lg font-semibold text-slate-700 transition-colors duration-500 dark:text-slate-200">No transactions found</div>
  ```

- **Line 42** (6 utilities)
  ```tsx
  <thead className="bg-slate-200 text-slate-700 transition-colors duration-500 dark:bg-slate-700 dark:text-slate-300">
  ```

- **Line 44** (9 utilities)
  ```tsx
  <th className="w-[15%] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Date</th>
  ```

- **Line 45** (8 utilities)
  ```tsx
  <th className="w-[30%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Merchant</th>
  ```

- **Line 46** (9 utilities)
  ```tsx
  <th className="w-[15%] whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Amount</th>
  ```

- **Line 47** (9 utilities)
  ```tsx
  <th className="w-[20%] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Account</th>
  ```

- **Line 48** (9 utilities)
  ```tsx
  <th className="w-[20%] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Category</th>
  ```

- **Line 69** (9 utilities)
  ```tsx
  <td className="relative whitespace-nowrap px-4 py-3 align-middle text-slate-900 transition-colors duration-500 dark:text-white">
  ```

- **Line 73** (7 utilities)
  ```tsx
  <span className="block truncate font-medium text-slate-900 transition-colors duration-500 dark:text-white">
  ```

- **Line 114** (12 utilities)
  ```tsx
  <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/50 px-4 py-4 transition-colors duration-500 dark:border-slate-700/50 dark:bg-slate-800/30">
  ```

- **Line 123** (27 utilities)
  ```tsx
  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 134** (27 utilities)
  ```tsx
  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
  ```

---

### `components/ErrorBoundary.tsx`

**Violations:** 11

- **Line 104** (10 utilities)
  ```tsx
  <div className="max-w-md mx-auto text-center p-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
  ```

- **Line 114** (8 utilities)
  ```tsx
  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
  ```

- **Line 123** (10 utilities)
  ```tsx
  <div className="max-w-md mx-auto text-center p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
  ```

- **Line 133** (9 utilities)
  ```tsx
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mr-2"
  ```

- **Line 139** (8 utilities)
  ```tsx
  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
  ```

- **Line 148** (10 utilities)
  ```tsx
  <div className="max-w-md mx-auto text-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
  ```

- **Line 158** (9 utilities)
  ```tsx
  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors mr-2"
  ```

- **Line 167** (10 utilities)
  ```tsx
  <div className="max-w-md mx-auto text-center p-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
  ```

- **Line 178** (9 utilities)
  ```tsx
  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors mr-2"
  ```

- **Line 185** (8 utilities)
  ```tsx
  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
  ```

- **Line 197** (7 utilities)
  ```tsx
  <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
  ```

---

### `pages/AccountsPage.tsx`

**Violations:** 10

- **Line 148** (11 utilities)
  ```tsx
  <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-12 text-center shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]">
  ```

- **Line 156** (11 utilities)
  ```tsx
  <section className="relative overflow-hidden rounded-[2.25rem] border border-red-200/70 bg-red-50/80 p-12 text-center shadow-[0_32px_110px_-60px_rgba(220,38,38,0.45)] backdrop-blur-[28px] dark:border-red-700/60 dark:bg-red-900/25">
  ```

- **Line 165** (10 utilities)
  ```tsx
  <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-10 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]">
  ```

- **Line 168** (14 utilities)
  ```tsx
  <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#475569] shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-[#cbd5e1]">
  ```

- **Line 171** (6 utilities)
  ```tsx
  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
  ```

- **Line 188** (25 utilities)
  ```tsx
  className="relative flex h-full flex-col gap-4 rounded-[1.75rem] border border-white/45 bg-white/80 p-6 text-left transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-75 dark:border-white/10 dark:bg-[#111a2f]/85 dark:hover:border-sky-400/40 dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)] dark:focus-visible:ring-offset-[#0f172a]"
  ```

- **Line 192** (11 utilities)
  ```tsx
  <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
  ```

- **Line 200** (6 utilities)
  ```tsx
  <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-sky-500" />
  ```

- **Line 205** (11 utilities)
  ```tsx
  <div className="mt-auto inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_48px_-32px_rgba(14,165,233,0.65)]">
  ```

- **Line 267** (11 utilities)
  ```tsx
  <div className="sm:col-span-3 rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 text-left shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
  ```

---

### `Auth.tsx`

**Violations:** 9

- **Line 49** (10 utilities)
  ```tsx
  <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-left shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
  ```

- **Line 57** (7 utilities)
  ```tsx
  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
  ```

- **Line 75** (7 utilities)
  ```tsx
  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
  ```

- **Line 179** (10 utilities)
  ```tsx
  <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-left shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
  ```

- **Line 187** (7 utilities)
  ```tsx
  className="block text-xs font-semibold tracking-[0.18em] text-slate-700 uppercase dark:text-slate-200"
  ```

- **Line 210** (7 utilities)
  ```tsx
  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
  ```

- **Line 229** (7 utilities)
  ```tsx
  className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200"
  ```

- **Line 249** (10 utilities)
  ```tsx
  <div className="rounded-lg border border-white/55 bg-white/85 px-3.5 py-3 text-[0.7rem] shadow-[0_16px_42px_-38px_rgba(15,23,42,0.4)] dark:border-white/12 dark:bg-[#111a2f] dark:text-slate-300">
  ```

- **Line 250** (7 utilities)
  ```tsx
  <h3 className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-slate-700 dark:text-slate-200">
  ```

---

### `components/BankCard.tsx`

**Violations:** 9

- **Line 96** (18 utilities)
  ```tsx
  <div className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/85 text-[#0ea5e9] shadow-[0_20px_55px_-32px_rgba(14,165,233,0.55)] ring-1 ring-white/55 transition-colors duration-300 ease-out dark:bg-[#1e293b]/85 dark:text-[#38bdf8] dark:shadow-[0_22px_60px_-34px_rgba(56,189,248,0.45)] dark:ring-white/12">
  ```

- **Line 97** (8 utilities)
  ```tsx
  <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0ea5e9]/24 via-transparent to-[#a78bfa]/28 opacity-80" />
  ```

- **Line 98** (8 utilities)
  ```tsx
  <span className="pointer-events-none absolute inset-[22%] rounded-2xl bg-white/40 blur-[18px] opacity-60 dark:bg-white/10" />
  ```

- **Line 130** (12 utilities)
  ```tsx
  className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/85 p-6 backdrop-blur-sm transition-colors duration-300 dark:border-white/10 dark:bg-[#111a2f]/75"
  ```

- **Line 138** (9 utilities)
  ```tsx
  <div className="relative z-10 flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
  ```

- **Line 143** (10 utilities)
  ```tsx
  <h3 className="break-words text-lg font-semibold leading-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white md:text-xl">
  ```

- **Line 147** (10 utilities)
  ```tsx
  <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">
  ```

- **Line 153** (6 utilities)
  ```tsx
  <div className="flex flex-shrink-0 items-center justify-start gap-2 md:justify-end">
  ```

- **Line 186** (9 utilities)
  ```tsx
  className="mt-4 space-y-6 border-t border-white/60 pt-4 transition-colors duration-300 ease-out dark:border-white/10"
  ```

---

### `components/onboarding/WelcomeStep.tsx`

**Violations:** 9

- **Line 71** (9 utilities)
  ```tsx
  <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-white md:text-[2.6rem] transition-colors duration-300 ease-out">
  ```

- **Line 74** (7 utilities)
  ```tsx
  <p className="text-base leading-relaxed text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">
  ```

- **Line 85** (23 utilities)
  ```tsx
  className="group flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] px-4 py-4 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:hover:border-[#38bdf8]"
  ```

- **Line 93** (10 utilities)
  ```tsx
  <span className="absolute inset-[20%] rounded-full bg-slate-300/30 blur-[6px] opacity-40 dark:bg-black/20 transition-colors duration-300 ease-out" />
  ```

- **Line 96** (8 utilities)
  ```tsx
  <p className="mt-3 text-sm font-semibold text-[#0f172a] dark:text-white transition-colors duration-300 ease-out">{title}</p>
  ```

- **Line 97** (7 utilities)
  ```tsx
  <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">{copy}</p>
  ```

- **Line 104** (14 utilities)
  ```tsx
  <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] dark:text-[#cbd5e1] sm:mb-4 transition-colors duration-300 ease-out">
  ```

- **Line 107** (13 utilities)
  ```tsx
  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-[#0f172a] shadow-lg sm:aspect-[18/10] transition-all duration-300 ease-out">
  ```

- **Line 111** (6 utilities)
  ```tsx
  className="absolute inset-0 h-full w-full object-cover object-top"
  ```

---

### `components/DisconnectModal.tsx`

**Violations:** 8

- **Line 48** (7 utilities)
  ```tsx
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  ```

- **Line 54** (8 utilities)
  ```tsx
  className="absolute inset-0 bg-[#0f172a]/70 backdrop-blur-sm transition-colors duration-300 ease-out dark:bg-black/70"
  ```

- **Line 64** (14 utilities)
  ```tsx
  className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/18 bg-white/92 p-6 shadow-[0_32px_95px_-48px_rgba(15,23,42,0.55)] transition-colors duration-300 ease-out dark:border-white/12 dark:bg-[#0f172a]/92 dark:shadow-[0_36px_100px_-46px_rgba(2,6,23,0.78)]"
  ```

- **Line 67** (7 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[1.6rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(15,23,42,0.12)] opacity-80 dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
  ```

- **Line 74** (12 utilities)
  ```tsx
  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fef3c7]/80 text-[#d97706] shadow-[0_18px_45px_-30px_rgba(248,196,113,0.65)] ring-1 ring-[#fbbf24]/40 dark:bg-[#451a03]/70 dark:text-[#facc15] dark:ring-[#facc15]/35">
  ```

- **Line 79** (8 utilities)
  ```tsx
  <h2 className="mb-2 text-lg font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
  ```

- **Line 82** (7 utilities)
  ```tsx
  <p className="text-sm leading-relaxed text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 90** (6 utilities)
  ```tsx
  <div className="relative z-10 mt-6 flex justify-end gap-3">
  ```

---

### `layouts/PageLayout.tsx`

**Violations:** 8

- **Line 27** (15 utilities)
  ```tsx
  <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-8 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)] sm:p-12">
  ```

- **Line 29** (6 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
  ```

- **Line 30** (12 utilities)
  ```tsx
  <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/72 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
  ```

- **Line 34** (6 utilities)
  ```tsx
  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
  ```

- **Line 37** (14 utilities)
  ```tsx
  <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-slate-200">
  ```

- **Line 42** (9 utilities)
  ```tsx
  <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl">
  ```

- **Line 46** (7 utilities)
  ```tsx
  <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
  ```

- **Line 61** (9 utilities)
  ```tsx
  <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
  ```

---

### `components/widgets/HeroStatCard.tsx`

**Violations:** 7

- **Line 201** (9 utilities)
  ```tsx
  className="hero-stat-card__gradient pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
  ```

- **Line 214** (8 utilities)
  ```tsx
  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">{title}</div>
  ```

- **Line 217** (6 utilities)
  ```tsx
  <div className="text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{value}</div>
  ```

- **Line 219** (6 utilities)
  ```tsx
  <div className="text-sm font-medium text-slate-600 transition-colors duration-500 dark:text-slate-300">{suffix}</div>
  ```

- **Line 227** (9 utilities)
  ```tsx
  className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  ```

- **Line 295** (12 utilities)
  ```tsx
  <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
  ```

- **Line 298** (12 utilities)
  ```tsx
  <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
  ```

---

### `components/AccountRow.tsx`

**Violations:** 6

- **Line 68** (16 utilities)
  ```tsx
  <div className="group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white/92 px-4 py-4 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)] dark:border-[#334155] dark:bg-[#101a2d]/92 dark:shadow-[0_20px_54px_-34px_rgba(2,6,23,0.65)]">
  ```

- **Line 69** (16 utilities)
  ```tsx
  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0ea5e9]/12 via-transparent to-[#a78bfa]/14 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 dark:from-[#38bdf8]/18 dark:via-transparent dark:to-[#a78bfa]/18" />
  ```

- **Line 72** (7 utilities)
  ```tsx
  <div className="text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
  ```

- **Line 86** (11 utilities)
  ```tsx
  <div className="flex items-center gap-2 text-xs font-medium capitalize text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
  ```

- **Line 89** (6 utilities)
  ```tsx
  <span className="font-mono text-[#94a3b8] transition-colors duration-300 ease-out dark:text-[#64748b]">
  ```

- **Line 93** (18 utilities)
  ```tsx
  <span className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-xs font-semibold text-[#475569] transition-colors duration-300 ease-out dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
  ```

---

### `components/ProviderMismatchModal.tsx`

**Violations:** 5

- **Line 48** (6 utilities)
  ```tsx
  <div className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  ```

- **Line 51** (13 utilities)
  ```tsx
  <div ref={modalRef} className="relative z-10 mx-4 w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl dark:border-white/10 dark:bg-slate-900/95">
  ```

- **Line 58** (6 utilities)
  ```tsx
  <h2 id="modal-title" className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white">
  ```

- **Line 69** (9 utilities)
  ```tsx
  Please update your environment configuration to set <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">DEFAULT_PROVIDER={userProvider}</code> and restart the application.
  ```

- **Line 76** (21 utilities)
  ```tsx
  className="w-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-sky-600 hover:to-blue-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
  ```

---

### `features/plaid/components/ConnectionsList.tsx`

**Violations:** 5

- **Line 33** (16 utilities)
  ```tsx
  <div className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/20 px-8 py-12 text-center shadow-[0_32px_110px_-62px_rgba(15,23,42,0.72)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-64px_rgba(2,6,23,0.82)]">
  ```

- **Line 35** (6 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
  ```

- **Line 36** (12 utilities)
  ```tsx
  <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/65 via-white/24 to-transparent transition-colors duration-500 dark:from-slate-900/66 dark:via-slate-900/32 dark:to-transparent" />
  ```

- **Line 39** (6 utilities)
  ```tsx
  <div className="relative z-10 flex flex-col items-center gap-4">
  ```

- **Line 40** (12 utilities)
  ```tsx
  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-[#0ea5e9] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] ring-1 ring-white/55 dark:bg-[#1e293b]/80 dark:text-[#38bdf8] dark:ring-white/10">
  ```

---

### `features/transactions/components/TransactionsFilters.tsx`

**Violations:** 5

- **Line 49** (24 utilities)
  ```tsx
  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#111a2f] dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-400/80 dark:focus:ring-offset-[#0f172a]"
  ```

- **Line 55** (9 utilities)
  ```tsx
  <span className="flex-shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">
  ```

- **Line 62** (8 utilities)
  ```tsx
  className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1 pl-1 pt-1"
  ```

- **Line 89** (12 utilities)
  ```tsx
  <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 dark:from-[#0f172a]" />
  ```

- **Line 92** (12 utilities)
  ```tsx
  <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 dark:from-[#0f172a]" />
  ```

---

### `App.tsx`

**Violations:** 4

- **Line 105** (9 utilities)
  ```tsx
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
  ```

- **Line 113** (7 utilities)
  ```tsx
  <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
  ```

- **Line 114** (9 utilities)
  ```tsx
  <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
  ```

- **Line 120** (12 utilities)
  ```tsx
  className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
  ```

---

### `SessionManager.tsx`

**Violations:** 4

- **Line 66** (8 utilities)
  ```tsx
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
  ```

- **Line 67** (10 utilities)
  ```tsx
  <div className="mx-4 w-full max-w-md rounded-[2.25rem] bg-white p-6 shadow-xl transition-colors duration-300 dark:bg-slate-800">
  ```

- **Line 83** (9 utilities)
  ```tsx
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
  ```

- **Line 90** (9 utilities)
  ```tsx
  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
  ```

---

### `pages/DashboardPage.tsx`

**Violations:** 4

- **Line 137** (6 utilities)
  ```tsx
  <div ref={spendingOverviewRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
  ```

- **Line 236** (9 utilities)
  ```tsx
  <div className="flex-1 min-h-[220px] rounded-xl bg-slate-100/60 dark:bg-slate-900/40 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
  ```

- **Line 305** (9 utilities)
  ```tsx
  className="fixed left-0 right-0 z-50 flex justify-center transition-[bottom] duration-300 ease-out"
  ```

- **Line 308** (15 utilities)
  ```tsx
  <div className="flex gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 shadow-xl backdrop-blur-md ring-1 ring-slate-200/60 dark:ring-slate-700/60">
  ```

---

### `pages/TransactionsPage.tsx`

**Violations:** 4

- **Line 132** (13 utilities)
  ```tsx
  <div className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/18 p-0 shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]">
  ```

- **Line 134** (6 utilities)
  ```tsx
  <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
  ```

- **Line 135** (11 utilities)
  ```tsx
  <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/25 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
  ```

- **Line 138** (6 utilities)
  ```tsx
  <div className="border-b border-slate-200/70 px-6 pb-4 pt-6 dark:border-slate-700/50">
  ```

---

### `components/HeaderAccountFilter.tsx`

**Violations:** 3

- **Line 115** (18 utilities)
  ```tsx
  className="absolute top-full right-0 mt-2 w-80 max-h-96 flex flex-col rounded-xl border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg z-50 origin-top"
  ```

- **Line 137** (6 utilities)
  ```tsx
  <div key={bankName} className="border-t border-slate-200 dark:border-slate-700 pt-2 first:border-t-0 first:pt-0">
  ```

- **Line 159** (6 utilities)
  ```tsx
  <label htmlFor={`bank-${bankName}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1 cursor-pointer">
  ```

---

### `components/ui/AppHeader.tsx`

**Violations:** 3

- **Line 20** (9 utilities)
  ```tsx
  <div className="flex items-center gap-2 font-semibold text-lg text-slate-900 dark:text-slate-100 transition-colors duration-300">Sumaura</div>
  ```

- **Line 24** (14 utilities)
  ```tsx
  className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-slate-700 dark:text-slate-300"
  ```

- **Line 32** (15 utilities)
  ```tsx
  className="px-2.5 py-1 text-xs rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
  ```

---

### `layouts/AppLayout.tsx`

**Violations:** 3

- **Line 38** (9 utilities)
  ```tsx
  <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
  ```

- **Line 70** (8 utilities)
  ```tsx
  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
  ```

- **Line 95** (8 utilities)
  ```tsx
  <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
  ```

---

### `components/Toast.tsx`

**Violations:** 2

- **Line 15** (24 utilities)
  ```tsx
  className="fixed bottom-6 right-6 z-50 flex items-center gap-4 overflow-hidden rounded-2xl border border-white/35 bg-white/90 px-5 py-3.5 text-sm font-medium text-[#0f172a] shadow-[0_24px_70px_-38px_rgba(15,23,42,0.55)] backdrop-blur-md transition-colors duration-300 ease-out dark:border-white/12 dark:bg-[#0f172a]/92 dark:text-white"
  ```

- **Line 19** (31 utilities)
  ```tsx
  className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#475569] shadow-[0_12px_34px_-26px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#334155] dark:bg-[#1e293b]/85 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
  ```

---

### `components/ui/Card.tsx`

**Violations:** 2

- **Line 15** (7 utilities)
  ```tsx
  <div className="absolute inset-0 rounded-[2.25rem] ring-inset ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
  ```

- **Line 16** (12 utilities)
  ```tsx
  <div className="absolute inset-0 rounded-[2.25rem] bg-gradient-to-b from-white/65 via-white/25 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
  ```

---

### `features/analytics/components/SpendingByCategoryChart.tsx`

**Violations:** 2

- **Line 17** (6 utilities)
  ```tsx
  <div className="group relative flex items-center justify-center py-2">
  ```

- **Line 73** (6 utilities)
  ```tsx
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  ```

---

### `features/analytics/components/TopMerchantsList.tsx`

**Violations:** 2

- **Line 19** (15 utilities)
  ```tsx
  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 transition-all duration-300 hover:border-[#93c5fd] dark:hover:border-[#38bdf8] hover:-translate-y-[2px]"
  ```

- **Line 22** (13 utilities)
  ```tsx
  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-900 text-xs font-bold flex-shrink-0">
  ```

---

### `features/budgets/components/BudgetProgress.tsx`

**Violations:** 2

- **Line 10** (8 utilities)
  ```tsx
  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-300 dark:bg-slate-700/60 dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]">
  ```

- **Line 20** (8 utilities)
  ```tsx
  <div className="flex items-center justify-between text-[0.75rem] text-slate-500 transition-colors duration-300 dark:text-slate-400">
  ```

---

### `features/budgets/components/BudgetForm.tsx`

**Violations:** 1

- **Line 29** (22 utilities)
  ```tsx
  className="min-w-[180px] flex-1 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#111a2f]/80 dark:text-slate-100 dark:focus:ring-offset-[#0f172a]"
  ```

---

## Next Steps

1. **Prioritize high-violation files** (listed first above)
2. **Create GitHub issues** for refactoring tasks using template:
   ```markdown
   **File:** src/path/to/file.tsx
   **Violations:** X
   **Action:** Extract to primitive / Use existing primitive / Document exception
   ```
3. **Re-run audit** after refactoring: `npm run audit:tailwind`
4. **Track progress** over time by comparing report dates

---

## Related Documentation

- [STYLING_GUIDE.md](STYLING_GUIDE.md) - When to use primitives vs inline classes
- [Primitives README](../src/ui/primitives/README.md) - Available primitives and variants
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines with styling section

---

*This audit was generated automatically by `scripts/audit-tailwind-usage.js`.*
