import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  PieChart, Pie, Tooltip, Cell,
  XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { usePlaidConnections } from "../hooks/usePlaidConnections";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePlaidLink } from 'react-plaid-link';
import { TransactionService } from "../services/TransactionService";
import { AnalyticsService } from "../services/AnalyticsService";
import { PlaidService } from "../services/PlaidService";
import { ApiClient } from "../services/ApiClient";
import { BankCard } from "./BankCard";
import { Toast } from "./Toast";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, RefreshCw, Link2 } from "lucide-react";
import BalancesOverview from "./BalancesOverview";
import { computeDateRange as computeDateRangeUtil, type DateRangeKey as DateRange } from "../utils/dateRanges";
import Card from "./ui/Card";
import { Th, Td } from "./ui/Table";
import TransactionsPage from "../pages/TransactionsPage";
import DashboardPage from "../pages/DashboardPage";
import BudgetsPage from "../pages/BudgetsPage";

const getChartColors = (isDark: boolean) => ({
  primary: isDark ? '#38bdf8' : '#0ea5e9',
  secondary: isDark ? '#34d399' : '#10b981',
  accent: isDark ? '#fbbf24' : '#f59e0b',
  warning: isDark ? '#f87171' : '#ef4444',
  info: isDark ? '#a78bfa' : '#8b5cf6',
  success: isDark ? '#10b981' : '#059669',
});

const getChartColorArray = (isDark: boolean) => [
  isDark ? '#38bdf8' : '#0ea5e9',
  isDark ? '#34d399' : '#10b981',
  isDark ? '#fbbf24' : '#f59e0b',
  isDark ? '#f87171' : '#ef4444',
  isDark ? '#a78bfa' : '#8b5cf6',
  isDark ? '#10b981' : '#059669',
];

const getTooltipStyle = (isDark: boolean) => ({
  background: isDark ? '#1e293b' : '#ffffff',
  border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
  color: isDark ? '#f8fafc' : '#0f172a',
  borderRadius: '8px',
  boxShadow: isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  fontSize: '14px',
  fontWeight: '500',
});


function generateId() {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis.crypto as any).randomUUID) {
    return (globalThis.crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Txn = {
  id: string;
  date: string;
  name: string;
  merchant?: string;
  amount: number;
  category: { id: string; name: string };
  account_name: string;
  account_type: string;
  account_mask?: string;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  constructor(props: any){ super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err: any){ return { err }; }
  componentDidCatch(err: any, info: any){ console.error("ErrorBoundary:", err, info); }
  render(){ if(this.state.err){ return (<div style={{padding:16,color:'#e5e7eb'}}><h3>Something went wrong</h3><pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.err)}</pre></div>);} return this.props.children as any; }
}


interface BankConnection {
  id: string;
  name: string;
  short: string; // initials for avatar
  status: "connected" | "needs_reauth" | "error";
  lastSync?: string; // ISO date string
  accounts: {
    id: string;
    name: string;
    mask: string;
    type: "checking" | "savings" | "credit" | "loan" | "other";
    balance?: number;
    transactions?: number;
  }[];
}

interface AuthenticatedAppProps {
  onLogout: () => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
}

export function AuthenticatedApp({ onLogout, dark, setDark }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<"dashboard" | "transactions" | "budgets" | "connect">("dashboard");
  const budgetsLoadedRef = useRef(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [search, setSearch] = useState(""); // kept for other tabs inputs if needed
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("current-month");
  const spendingOverviewRef = useRef<HTMLDivElement | null>(null);
  const balancesOverviewRef = useRef<HTMLDivElement | null>(null);
  const [showTimeBar, setShowTimeBar] = useState(false);

  useEffect(() => {
    if (tab !== 'dashboard') {
      setShowTimeBar(false);
      return;
    }
    const target = balancesOverviewRef.current;
    if (!target) {
      setShowTimeBar(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const fullyVisible = entry.intersectionRatio >= 1;
        setShowTimeBar(!fullyVisible);
      },
      {
        threshold: [0, 1],
      }
    );
    observer.observe(target);
    const rect = target.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const fullyVisibleNow = rect.top >= 0 && rect.bottom <= viewportH;
    setShowTimeBar(!fullyVisibleNow);
    return () => observer.disconnect();
  }, [tab]);

  // budgets: moved to BudgetsPage

  const [toast, setToast] = useState<string | null>(null);
  const plaidConnections = usePlaidConnections();
  const banks = useMemo(() => {
    return plaidConnections.connections.map(conn => ({
      id: conn.connectionId,
      name: conn.institutionName,
      short: conn.institutionName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      status: conn.isConnected ? 'connected' as const : 'error' as const,
      lastSync: conn.lastSyncAt,
      accounts: conn.accounts
    }))
  }, [plaidConnections.connections]);

  // All-time cached data for client-side filtering
  const [allTimeTransactions, setAllTimeTransactions] = useState<Txn[]>([]);
  const [allTimeAnalytics, setAllTimeAnalytics] = useState({
    categories: [] as any[],
    topMerchants: [] as any[],
    monthlyTotals: [] as any[]
  });

  // budgets: moved to BudgetsPage

  const [monthSpend, setMonthSpend] = useState(0);
  const [byCat, setByCat] = useState<{ name: string; value: number }[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);
  const [netSeries, setNetSeries] = useState<{ date: string; value: number }[]>([]);
  const [netLoading, setNetLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isLoadingAnalyticsRef = useRef(false);
  const allTimeTransactionsRef = useRef<Txn[]>([]);

  allTimeTransactionsRef.current = allTimeTransactions;


  const computeDateRange = useCallback((key?: DateRange): { start?: string, end?: string } => {
    return computeDateRangeUtil(key);
  }, []);

  const filterTransactionsByDateRange = useCallback((transactions: Txn[], dateRangeKey: DateRange): Txn[] => {
    const { start, end } = computeDateRange(dateRangeKey);
    if (!start || !end) {
      return transactions;
    }

    const filtered = transactions.filter(txn => {
      const txnDate = new Date(txn.date).toISOString().slice(0, 10);
      return txnDate >= start && txnDate <= end;
    });


    return filtered;
  }, []);

  useEffect(() => {
    const { start, end } = computeDateRange(dateRange);
    if (!start || !end) {
      setNetSeries([]);
      return;
    }
    let cancelled = false;
    setNetLoading(true);
    setNetError(null);
    AnalyticsService.getNetWorthOverTime(start, end)
      .then(series => { if (!cancelled) setNetSeries(series || []); })
      .catch((e: any) => { if (!cancelled) setNetError(e?.message || 'Failed to load net worth'); })
      .finally(() => { if (!cancelled) setNetLoading(false); });
    return () => { cancelled = true; };
  }, [dateRange, computeDateRange]);

  const calculateCategorySpendingFromTransactions = useCallback((transactions: Txn[]): { name: string; value: number }[] => {
    const categoryTotals = transactions.reduce((acc, txn) => {
      const categoryName = txn.category.name || 'Unknown';
      const amount = Number(txn.amount);
      if (!Number.isFinite(amount)) {
        console.warn('Invalid amount in category calculation:', txn.amount, txn);
        return acc;
      }
      acc[categoryName] = (acc[categoryName] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    const result = Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value: Number.isFinite(value) ? value : 0 }))
      .filter(cat => cat.value > 0)
      .sort((a, b) => b.value - a.value);
    
    return result;
  }, []);

  const calculateDailySpendingFromTransactions = useCallback((transactions: Txn[]): any[] => {
    const dailyTotals = transactions.reduce((acc, txn) => {
      const dateStr = txn.date;
      acc[dateStr] = (acc[dateStr] || 0) + txn.amount;
      return acc;
    }, {} as Record<string, number>);

    const result = Object.entries(dailyTotals)
      .map(([date, amount]) => ({
        date,
        amount: Number(amount), // Ensure amount is numeric for charts
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return result;
  }, []);

  const calculateTopMerchantsFromTransactions = useCallback((transactions: Txn[]): any[] => {
    const merchantTotals = transactions.reduce((acc, txn) => {
      const merchantName = txn.merchant || 'Unknown Merchant';
      const amount = Number(txn.amount);
      
      if (!Number.isFinite(amount)) {
        return acc;
      }
      
      if (!acc[merchantName]) {
        acc[merchantName] = { amount: 0, count: 0 };
      }
      acc[merchantName].amount += amount;
      acc[merchantName].count += 1;
      
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    const totalSpending = transactions.reduce((sum, txn) => {
      const amount = Number(txn.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    
    const result = Object.entries(merchantTotals)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: totalSpending > 0 ? ((data.amount / totalSpending) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    return result;
  }, []);

  const calculateTotalSpendingFromTransactions = useCallback((transactions: Txn[]): number => {
    const total = transactions.reduce((total, txn) => {
      const amount = Number(txn.amount);
      if (!Number.isFinite(amount)) {
        console.warn('Invalid amount in transaction:', txn.amount, txn);
        return total;
      }
      return total + amount;
    }, 0);
    return Number.isFinite(total) ? total : 0;
  }, []);

  const netDotRenderer = useMemo(() => {
    const n = netSeries?.length || 0;
    const fill = dark ? '#0b1220' : '#ffffff';
    const stroke = '#10b981';
    if (!n) {
      return () => null;
    }

    const changeIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      const prev = Number(netSeries[i - 1]?.value ?? 0);
      const curr = Number(netSeries[i]?.value ?? 0);
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
      if (curr !== prev) changeIdx.push(i);
    }

    const maxDots = 30;
    const selected = new Set<number>();
    if (changeIdx.length > 0) {
      const stride = Math.max(1, Math.ceil(changeIdx.length / maxDots));
      for (let k = 0; k < changeIdx.length; k += stride) {
        selected.add(changeIdx[k]);
      }

      selected.add(changeIdx[changeIdx.length - 1]);
    }

    return (props: any) => {
      const { index, cx, cy } = props || {};
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />;
    };
  }, [netSeries, dark]);

  const handleDisconnect = async () => {
    try {
      // Disconnect all connections
      await Promise.all(plaidConnections.connections.map(conn => PlaidService.disconnect()))
      plaidConnections.connections.forEach(conn => plaidConnections.removeConnection(conn.connectionId))
      setAccessToken(null)
      setError(null)
      setAllTimeTransactions([])
    } catch (error) {
      setError('Failed to disconnect: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleSyncBank = async (bankId: string) => {
    const connection = plaidConnections.getConnection(bankId)
    if (!connection) return

    try {
      plaidConnections.setConnectionSyncInProgress(bankId, true)
      
      const result = await PlaidService.syncTransactions(bankId)
      const { transactions, metadata } = result
      
      plaidConnections.updateConnectionSyncInfo(
        bankId,
        metadata.transaction_count,
        metadata.account_count,
        metadata.sync_timestamp
      )
      
      setToast(`Synced ${transactions.length} new transactions from ${connection.institutionName}`)
    } catch (error) {
      setError(`Sync failed for ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      plaidConnections.setConnectionSyncInProgress(bankId, false)
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await Promise.all(plaidConnections.connections.map((conn) => handleSyncBank(conn.connectionId)));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDisconnectBank = async (bankId: string) => {
    const connection = plaidConnections.getConnection(bankId)
    if (!connection) return

    try {
      await PlaidService.disconnect()
      plaidConnections.removeConnection(bankId)
      setToast(`${connection.institutionName} disconnected successfully`)
    } catch (error) {
      setError(`Failed to disconnect ${connection.institutionName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  };

  const handlePlaidOnSuccess = useCallback(async (publicToken: string) => {
    try {
      const data = await ApiClient.post<{ access_token: string }>(
        '/plaid/exchange-token',
        { public_token: publicToken }
      )
      setAccessToken(data.access_token)
      setToast('Bank connected successfully!')

      try {
        const status = await PlaidService.getStatus()
        if (status?.connected) {
          await plaidConnections.addConnection('Connected Bank', 'legacy')
        } else {
          await plaidConnections.refresh()
        }
      } catch {
        await plaidConnections.refresh()
      }
    } catch (error) {
      setError(`Failed to exchange token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [plaidConnections])

  const handlePlaidOnExit = useCallback((error: any) => {
    if (error) {
      setError(`Plaid Link exited with error: ${error.error_message || 'Unknown error'}`)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidOnSuccess,
    onExit: handlePlaidOnExit,
  })

  const handleAddBankDirect = useCallback(async () => {
    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const data = await ApiClient.post<{ link_token: string }>(
        '/plaid/link-token',
        { user_id: userId }
      )
      setLinkToken(data.link_token)
      
      if (open && ready) {
        open()
      }
    } catch (error) {
      setError(`Failed to start bank connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [open, ready]);

  useEffect(() => {
    if (linkToken && ready && open) {
      open()
    }
  }, [linkToken, ready, open])

  const loadTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const transactions = await TransactionService.getTransactions();
      setAllTimeTransactions(transactions);
      
      setError(null);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setError('Failed to load transactions: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  const loadAllTimeAnalyticsData = useCallback(async () => {
    if (isLoadingAnalyticsRef.current) return;
    
    isLoadingAnalyticsRef.current = true;
    setIsLoadingAnalytics(true);
    try {
      const { start: allTimeStart, end: allTimeEnd } = computeDateRange('all-time');
      const [totalSpending, categoryData, monthlyData, topMerchantsData] = await Promise.all([
        AnalyticsService.getSpendingTotal(allTimeStart, allTimeEnd),
        AnalyticsService.getCategorySpendingByDateRange(allTimeStart, allTimeEnd),
        AnalyticsService.getMonthlyTotals(6),
        AnalyticsService.getTopMerchantsByDateRange(allTimeStart, allTimeEnd)
      ]);

      setAllTimeAnalytics({
        categories: categoryData as any[],
        topMerchants: topMerchantsData as any[],
        monthlyTotals: monthlyData as any[]
      });

      setTopMerchants(topMerchantsData);
      
      setError(null);
      
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError('Failed to load analytics: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      isLoadingAnalyticsRef.current = false;
      setIsLoadingAnalytics(false);
    }
  }, []);


  const refreshData = useCallback(async () => {
    try {
      await Promise.all([loadTransactions(), loadAllTimeAnalyticsData()]);
      await plaidConnections.refresh();
    } catch (error) {
      console.error('Some services failed during refresh:', error);
    }
  }, [loadTransactions, loadAllTimeAnalyticsData, plaidConnections]);

  useEffect(() => {
    loadTransactions();
    loadAllTimeAnalyticsData();
  }, []); 

  const filteredData = useMemo(() => {
    if (allTimeTransactions.length === 0) {
      return {
        transactions: [],
        totalSpending: 0,
        categories: [],
        topMerchants: [],
      };
    }

    const filteredTransactions = filterTransactionsByDateRange(allTimeTransactions, dateRange);
    
    const totalSpending = calculateTotalSpendingFromTransactions(filteredTransactions);
    const categories = calculateCategorySpendingFromTransactions(filteredTransactions);
    const topMerchants = calculateTopMerchantsFromTransactions(filteredTransactions);
    return {
      transactions: filteredTransactions,
      totalSpending,
      categories,
      topMerchants,
    };
  }, [
    dateRange, 
    allTimeTransactions, 
    filterTransactionsByDateRange, 
    calculateTotalSpendingFromTransactions, 
    calculateCategorySpendingFromTransactions, 
    calculateTopMerchantsFromTransactions
  ]);

  useEffect(() => {
    setMonthSpend(prev => prev !== filteredData.totalSpending ? filteredData.totalSpending : prev);
    
    setByCat(prev => 
      JSON.stringify(prev) !== JSON.stringify(filteredData.categories) 
        ? filteredData.categories 
        : prev
    );
    
    setTopMerchants(prev => 
      JSON.stringify(prev) !== JSON.stringify(filteredData.topMerchants) 
        ? filteredData.topMerchants 
        : prev
    );
  }, [filteredData, dateRange]);


  return (
    <ErrorBoundary>
      <div className={`${dark ? "dark" : ""}`}>
        <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
          <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className={`px-4 ${scrolled ? 'h-14' : 'h-16'} flex items-center justify-between transition-all duration-200 ease-out`}>
              <div className={`flex items-center gap-2 font-semibold ${scrolled ? 'text-base' : 'text-lg'}`}>Sumaura</div>
              <nav className={`flex gap-2 ${scrolled ? 'text-xs' : 'text-sm'}`}>
                {(["dashboard", "transactions", "budgets", "connect"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`${scrolled ? 'px-2.5 py-1' : 'px-3 py-1.5'} rounded-xl border transition-all duration-200 ${tab === t ? "bg-primary-100 dark:bg-slate-600 border-primary-300 dark:border-slate-500 text-primary-700 dark:text-slate-100" : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"}`}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <button onClick={() => setDark(!dark)} className={`ml-2 ${scrolled ? 'px-2 py-1' : 'px-2 py-1.5'} rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200`} aria-label="Toggle theme" title="Toggle theme">
                  {dark ? "🌞" : "🌙"}
                </button>
                <button onClick={onLogout} className={`ml-2 ${scrolled ? 'px-2.5 py-1' : 'px-3 py-1.5'} rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200`} title="Logout">
                  Logout
                </button>
              </nav>
            </div>
          </header>

          <main className={`relative flex-1 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${tab === 'dashboard' ? 'pb-28' : ''}`}>
            {error && (
              <Card className="mb-6 border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">Error</div>
                <div className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</div>
              </Card>
            )}
            {tab === "dashboard" && (
              <div className="space-y-4">
                <DashboardPage dark={dark} />
              </div>
            )}
            {tab === "transactions" && (
              <div className="space-y-4">
                <TransactionsPage />
              </div>
            )}

            <div className={tab === 'budgets' ? '' : 'hidden'}>
              <div className="space-y-6">
                <BudgetsPage loadedFlag={budgetsLoadedRef} active={tab === 'budgets'} />
              </div>
            </div>

            {tab === "connect" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Bank Connections</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Securely connect your bank accounts to sync transactions.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {banks.length > 0 && (
                      <button
                        onClick={handleSyncAll}
                        disabled={syncingAll}
                        className={`inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium whitespace-nowrap shadow-sm ${
                          syncingAll 
                            ? 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-400 cursor-not-allowed' 
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600'
                        }`}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
                        {syncingAll ? 'Syncing...' : 'Sync all'}
                      </button>
                    )}
                    <button
                      onClick={handleAddBankDirect}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 px-3 text-sm font-semibold text-white shadow whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Add bank
                    </button>
                  </div>
                </div>

                {/* Bank Cards or Empty State */}
                {banks.length === 0 ? (
                    <div className="w-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/40 dark:bg-slate-800/40 p-10 text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-200/60 dark:bg-slate-700/60">
                        <Link2 className="h-6 w-6 text-slate-500 dark:text-slate-300" />
                      </div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold">No banks connected yet</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">Connect a bank to start syncing transactions.</p>
                      <button
                        onClick={handleAddBankDirect}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-transparent text-slate-600 dark:text-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700/60"
                      >
                        <Plus className="h-4 w-4" />
                        Add bank
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {banks.map((bank) => (
                        <BankCard
                          key={bank.id}
                          bank={bank}
                          onSync={handleSyncBank}
                          onDisconnect={handleDisconnectBank}
                        />
                      ))}
                    </div>
                  )}


                  {/* Toast Notifications */}
                  <AnimatePresence>
                    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
                  </AnimatePresence>


                {/* Footer hint to match app style */}
                <div className="mt-6 text-xs text-slate-500 dark:text-slate-500">
                  Sumaura — Powered by Plaid (12 demo + real connections)
                </div>
              </div>
            )}
          </main>

          <footer className="relative border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">💼 Sumaura — Powered by Plaid</span>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}
