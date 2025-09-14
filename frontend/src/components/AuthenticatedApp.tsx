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
// Budgets are front-end only for now
import { PlaidService } from "../services/PlaidService";
import { ApiClient } from "../services/ApiClient";
import { BudgetService } from "../services/BudgetService";
import { optimisticCreate, optimisticUpdate, optimisticDelete } from "../utils/optimistic";
import { 
  PencilSquareIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid'
import type { Budget } from "../types/api";
import { BankCard } from "./BankCard";
import { Toast } from "./Toast";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, RefreshCw, Link2, Calendar as CalendarIcon } from "lucide-react";
import BalancesOverview from "./BalancesOverview";
import { NetWorthOverTimeWidget } from "./NetWorthOverTimeWidget";
const fmtUSD = (n: number | string) => {
  const num = Number(n);
  if (!Number.isFinite(num) || isNaN(num)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', { style: "currency", currency: "USD" }).format(num);
};

const formatCategoryName = (categoryPrimary: string | undefined | null): string => {
  if (!categoryPrimary) return 'Other'
  
  return categoryPrimary
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
};

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

// Category tag color themes (Tailwind-safe literal classes)
const TAG_THEMES = [
  { key: 'sky',      tag: 'bg-sky-100 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200 border border-sky-300/20 dark:border-sky-300/20', ring: 'ring-sky-400', ringHex: '#38bdf8' },
  { key: 'emerald',  tag: 'bg-emerald-100 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200 border border-emerald-300/20 dark:border-emerald-300/20', ring: 'ring-emerald-400', ringHex: '#34d399' },
  { key: 'cyan',     tag: 'bg-cyan-100 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-200 border border-cyan-300/20 dark:border-cyan-300/20', ring: 'ring-cyan-400', ringHex: '#22d3ee' },
  { key: 'violet',   tag: 'bg-violet-100 dark:bg-violet-400/10 text-violet-800 dark:text-violet-200 border border-violet-300/20 dark:border-violet-300/20', ring: 'ring-violet-400', ringHex: '#a78bfa' },
  { key: 'amber',    tag: 'bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border border-amber-300/20 dark:border-amber-300/20', ring: 'ring-amber-400', ringHex: '#fbbf24' },
  { key: 'rose',     tag: 'bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border border-rose-300/20 dark:border-rose-300/20', ring: 'ring-rose-400', ringHex: '#fb7185' },
  { key: 'indigo',   tag: 'bg-indigo-100 dark:bg-indigo-400/10 text-indigo-800 dark:text-indigo-200 border border-indigo-300/20 dark:border-indigo-300/20', ring: 'ring-indigo-400', ringHex: '#818cf8' },
  { key: 'fuchsia',  tag: 'bg-fuchsia-100 dark:bg-fuchsia-400/10 text-fuchsia-800 dark:text-fuchsia-200 border border-fuchsia-300/20 dark:border-fuchsia-300/20', ring: 'ring-fuchsia-400', ringHex: '#e879f9' },
  { key: 'teal',     tag: 'bg-teal-100 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200 border border-teal-300/20 dark:border-teal-300/20', ring: 'ring-teal-400', ringHex: '#2dd4bf' },
  { key: 'lime',     tag: 'bg-lime-100 dark:bg-lime-400/10 text-lime-800 dark:text-lime-200 border border-lime-300/20 dark:border-lime-300/20', ring: 'ring-lime-400', ringHex: '#a3e635' },
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getTagThemeForCategory(name?: string | null) {
  const key = (name || 'Uncategorized').toLowerCase();
  const idx = hashString(key) % TAG_THEMES.length;
  return TAG_THEMES[idx];
}

function generateId() {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis.crypto as any).randomUUID) {
    return (globalThis.crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Removed custom inline icons; using Heroicons

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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg dark:shadow-2xl ${className}`}>
      {children}
    </div>
  );
}
type ThProps = React.ComponentProps<'th'>;
function Th({ children, className = "", ...rest }: ThProps) {
  return <th {...rest} className={`text-left p-3 ${className}`}>{children}</th>;
}
type TdProps = React.ComponentProps<'td'>;
function Td({ children, className = "", ...rest }: TdProps) {
  return <td {...rest} className={`p-3 ${className}`}>{children}</td>;
}

type DateRange = "current-month" | "past-2-months" | "past-3-months" | "past-6-months" | "past-year" | "all-time";

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
  const [txns, setTxns] = useState<Txn[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [search, setSearch] = useState(""); 
  const debouncedSearch = useDebouncedValue(search, 300);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const prevDateRangeRef = useRef<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("current-month");
  const spendingOverviewRef = useRef<HTMLDivElement | null>(null);
  // Track Balances Overview visibility to toggle the floating time bar
  const balancesOverviewRef = useRef<HTMLDivElement | null>(null);
  const [showTimeBar, setShowTimeBar] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  // Budgets tab month navigation (separate from dashboard range)
  const [budgetsMonth, setBudgetsMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Budgets editor state
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetFormAmount, setBudgetFormAmount] = useState('');
  const [budgetFormCategory, setBudgetFormCategory] = useState<string>('');

  // Derived values for budgets tab (after allTimeTransactions is defined below)

  const startAddBudget = useCallback(() => {
    setIsAddingBudget(true);
    setEditingBudgetId(null);
    setBudgetFormAmount('');
    setBudgetFormCategory('');
  }, []);

  const cancelBudgetEdit = useCallback(() => {
    setIsAddingBudget(false);
    setEditingBudgetId(null);
    setBudgetFormAmount('');
    setBudgetFormCategory('');
  }, []);

  useEffect(() => {
    // Show the floating time bar only when Balances Overview is not fully visible
    if (tab !== 'dashboard') {
      setShowTimeBar(false);
      return;
    }
    const target = balancesOverviewRef.current;
    if (!target) {
      // If we cannot observe, default to showing the bar
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
        // Use strict threshold to require full visibility
        threshold: [0, 1],
      }
    );
    observer.observe(target);
    // Perform an immediate visibility check to avoid initial flicker
    const rect = target.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const fullyVisibleNow = rect.top >= 0 && rect.bottom <= viewportH;
    setShowTimeBar(!fullyVisibleNow);
    return () => observer.disconnect();
  }, [tab]);

  const submitAddBudget = useCallback(async () => {
    const amountNum = Number(budgetFormAmount);
    if (!budgetFormCategory || !Number.isFinite(amountNum) || amountNum <= 0) return;
    // Optimistic add
    const temp: Budget = { id: generateId(), category: budgetFormCategory, amount: amountNum } as Budget;
    cancelBudgetEdit();
    try {
      await optimisticCreate(setBudgets, temp, () => BudgetService.createBudget({ category: temp.category, amount: temp.amount }));
    } catch (e: any) {
      console.error('Failed to create budget', e);
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 409
        ? `A budget for "${temp.category}" already exists.`
        : status === 401
          ? 'You are not authenticated. Please log in again.'
          : 'Failed to create budget.'
      setError(msg)
    }
  }, [budgetFormAmount, budgetFormCategory, cancelBudgetEdit]);

  const startEditBudget = useCallback((b: Budget) => {
    setEditingBudgetId(b.id);
    setIsAddingBudget(false);
    setBudgetFormAmount(String(b.amount));
    setBudgetFormCategory(b.category);
  }, []);

  const submitEditBudget = useCallback(async (id: string) => {
    const amountNum = Number(budgetFormAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
    try {
      await optimisticUpdate(setBudgets, id, (item) => ({ ...item, amount: amountNum } as Budget), () => BudgetService.updateBudget(id, { amount: amountNum }))
    } catch (e: any) {
      console.error('Failed to update budget', e)
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 401
        ? 'You are not authenticated. Please log in again.'
        : 'Failed to update budget.'
      setError(msg)
    } finally {
      cancelBudgetEdit();
    }
  }, [budgetFormAmount, cancelBudgetEdit]);

  const deleteBudget = useCallback(async (id: string) => {
    try {
      await optimisticDelete(setBudgets, id, () => BudgetService.deleteBudget(id))
    } catch (e: any) {
      console.error('Failed to delete budget', e)
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 401
        ? 'You are not authenticated. Please log in again.'
        : 'Failed to delete budget.'
      setError(msg)
    }
  }, []);
  // Transactions tab: category filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Connect tab: new bank connection UI state
  const [toast, setToast] = useState<string | null>(null);

  const plaidConnections = usePlaidConnections();
  
  // Convert plaidConnections to BankConnection format for compatibility
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

  // Budgets derived values (now that transactions state exists)
  const budgetsMonthLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(budgetsMonth), [budgetsMonth]);
  const budgetsMonthRange = useMemo(() => {
    const start = new Date(budgetsMonth.getFullYear(), budgetsMonth.getMonth(), 1);
    const end = new Date(budgetsMonth.getFullYear(), budgetsMonth.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }, [budgetsMonth]);

  const budgetsComputed = useMemo(() => {
    const { start, end } = budgetsMonthRange;
    return budgets.map(b => {
      // Match either the raw category id or the formatted name
      const catId = b.category;
      const catName = formatCategoryName(b.category).toLowerCase();
      const spent = allTimeTransactions
        .filter(t => (t.category?.id === catId) || ((t.category?.name || '').toLowerCase() === catName))
        .filter(t => {
          const ds = new Date(t.date).toISOString().slice(0,10);
          return ds >= start && ds <= end;
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const percentage = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
      return { ...b, spent, percentage } as any;
    });
  }, [budgets, allTimeTransactions, budgetsMonthRange]);

  const usedBudgetCategories = useMemo(() => new Set(budgets.map(b => b.category)), [budgets]);
  const allCategoryIds = useMemo(() => Array.from(new Set(allTimeTransactions.map(t => t.category?.id || 'other'))).sort(), [allTimeTransactions]);

  // Display state (filtered from all-time data)
  const [monthSpend, setMonthSpend] = useState(0);
  const [byCat, setByCat] = useState<{ name: string; value: number }[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);
  // Net worth over time (cash) state
  const [netSeries, setNetSeries] = useState<{ date: string; value: number }[]>([]);
  const [netLoading, setNetLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  // Lightweight loading state for debounced searches; keeps table visible
  const [isSearching, setIsSearching] = useState(false);
  // Shrink header when page is scrolled (sticky state)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const isLoadingAnalyticsRef = useRef(false);
  // Transactions tab pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Create ref to access latest allTimeTransactions without causing re-renders
  const allTimeTransactionsRef = useRef<Txn[]>([]);
  allTimeTransactionsRef.current = allTimeTransactions;

  // Maintain base list after search filtering; category filter applies on top
  const [baseTxns, setBaseTxns] = useState<Txn[]>([]);

  const applyCategoryFilter = useCallback((list: Txn[], category: string | null): Txn[] => {
    if (!category) return list;
    const catLower = category.toLowerCase();
    return list.filter(t => (t.category?.name || '').toLowerCase() === catLower);
  }, []);

  const updateTransactions = useCallback((searchTerm?: string) => {
    // Local, cache-only filtering of all transactions using ref
    const term = (searchTerm || '').trim().toLowerCase();
    const transactions = allTimeTransactionsRef.current;
    
    if (term === '') {
      setBaseTxns(transactions);
      setTxns(applyCategoryFilter(transactions, selectedCategory));
      return;
    }
    const filtered = transactions.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const merchant = (t.merchant || '').toLowerCase();
      const category = (t.category?.name || '').toLowerCase();
      return name.includes(term) || merchant.includes(term) || category.includes(term);
    });
    setBaseTxns(filtered);
    setTxns(applyCategoryFilter(filtered, selectedCategory));
  }, [applyCategoryFilter, selectedCategory]); // Stable reference

  const computeDateRange = useCallback((key?: DateRange): { start?: string, end?: string } => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const firstOfMonth = (year: number, month0: number) => new Date(year, month0, 1);
    const lastOfMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0,10);

    switch (key) {
      case 'current-month': {
        return { start: fmt(firstOfMonth(y, m)), end: fmt(lastOfMonth(y, m)) };
      }
      case 'past-2-months': {
        const start = firstOfMonth(y, m - 1);
        const end = lastOfMonth(y, m);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'past-3-months': {
        const start = firstOfMonth(y, m - 2);
        const end = lastOfMonth(y, m);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'past-6-months': {
        const start = firstOfMonth(y, m - 5);
        const end = lastOfMonth(y, m);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'past-year': {
        const start = firstOfMonth(y, m - 11);
        const end = lastOfMonth(y, m);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'all-time': {
        // Limit all-time to 5 years from current date
        const now = new Date();
        const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        return { 
          start: fmt(fiveYearsAgo), 
          end: fmt(now) 
        };
      }
      default:
        return {};
    }
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

  // Fetch Net Worth Over Time whenever dashboard dateRange changes
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
      .slice(0, 5); // Top 5 merchants
    
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

  // Adaptive dot renderer: show dots only on days with changes (proxy for transactions),
  // and cap visible dots to ~30 to reduce clutter.
  const netDotRenderer = useMemo(() => {
    const n = netSeries?.length || 0;
    const fill = dark ? '#0b1220' : '#ffffff';
    const stroke = '#10b981';
    if (!n) {
      return () => null;
    }

    // Determine indices where value changed vs previous day -> likely transaction days
    const changeIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      const prev = Number(netSeries[i - 1]?.value ?? 0);
      const curr = Number(netSeries[i]?.value ?? 0);
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
      if (curr !== prev) changeIdx.push(i);
    }

    // Cap the number of dots to ~30 using stride sampling over change indices
    const maxDots = 30;
    const selected = new Set<number>();
    if (changeIdx.length > 0) {
      const stride = Math.max(1, Math.ceil(changeIdx.length / maxDots));
      for (let k = 0; k < changeIdx.length; k += stride) {
        selected.add(changeIdx[k]);
      }
      // Always include the last change day for emphasis
      selected.add(changeIdx[changeIdx.length - 1]);
    }

    return (props: any) => {
      const { index, cx, cy } = props || {};
      if (index == null || cx == null || cy == null) return null;
      if (!selected.has(index)) return null;
      return <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />;
    };
  }, [netSeries, dark]);

  // Period comparison removed


  // Removed daily trend and day-of-week derived analytics


  const handleDisconnect = async () => {
    try {
      // Disconnect all connections
      await Promise.all(plaidConnections.connections.map(conn => PlaidService.disconnect()))
      plaidConnections.connections.forEach(conn => plaidConnections.removeConnection(conn.connectionId))
      setAccessToken(null)
      setError(null)
      setTxns([])
    } catch (error) {
      setError('Failed to disconnect: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }




  // Multi-connection bank handlers
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

  // Plaid Link callbacks
  const handlePlaidOnSuccess = useCallback(async (publicToken: string) => {
    try {
      const data = await ApiClient.post<{ access_token: string }>(
        '/plaid/exchange-token',
        { public_token: publicToken }
      )
      setAccessToken(data.access_token)
      setToast('Bank connected successfully!')

      // Immediately query backend for connection details and add to UI state
      // so the Connect tab reflects the new connection without a hard reload.
      try {
        const status = await PlaidService.getStatus()
        if (status?.connected) {
          // Backend status doesn’t include institution/connection id in current type
          await plaidConnections.addConnection('Connected Bank', 'legacy')
        } else {
          // Fallback: refresh if status isn’t yet updated
          await plaidConnections.refresh()
        }
      } catch {
        // If status fetch fails, at least attempt a refresh
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

  // Direct Plaid Link handler - replaces AddBankModal
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

  // Effect to open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready && open) {
      open()
    }
  }, [linkToken, ready, open])

  const loadTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const transactions = await TransactionService.getTransactions();
      
      // Store all-time transactions for client-side filtering
      setAllTimeTransactions(transactions);
      // Initialize the transactions list with backend data
      setBaseTxns(transactions);
      setTxns(applyCategoryFilter(transactions, selectedCategory));
      
      setError(null);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setError('Failed to load transactions: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [applyCategoryFilter, selectedCategory]);

  const loadAllTimeAnalyticsData = useCallback(async () => {
    // Prevent multiple concurrent loads using ref to avoid dependency issues
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

      // Store raw all-time analytics data for client-side filtering
      setAllTimeAnalytics({
        categories: categoryData as any[],
        topMerchants: topMerchantsData as any[],
        monthlyTotals: monthlyData as any[]
      });

      // Set other analytics display data (not transaction-based)
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

  const loadBudgets = useCallback(async () => {
    try {
      const list = await BudgetService.getBudgets()
      setBudgets(list)
    } catch (e: any) {
      // Leave budgets empty; UI shows friendly empty state
      setBudgets([])
      console.error('Failed to load budgets', e)
      // Non-blocking error surface
      const status = typeof e?.status === 'number' ? e.status : undefined
      if (status === 401) {
        setError('You are not authenticated. Please log in again.')
      } else {
        setError('Failed to load budgets.')
      }
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([loadTransactions(), loadAllTimeAnalyticsData()]);
      await plaidConnections.refresh();
    } catch (error) {
      // Individual functions handle their own errors, don't retry the whole refresh
      console.error('Some services failed during refresh:', error);
    }
  }, [loadTransactions, loadAllTimeAnalyticsData, plaidConnections]);


  // Load data once on mount, without dependency on refreshData to prevent loops
  useEffect(() => {
    loadTransactions();
    loadAllTimeAnalyticsData();
    loadBudgets();
  }, []); // Only run once on mount

  // (Removed backend search effect) Searching now handled entirely by consolidated effect below.

  // Unified client-side filtering using useMemo for smooth animations
  const filteredData = useMemo(() => {
    if (allTimeTransactions.length === 0) {
      return {
        transactions: [],
        totalSpending: 0,
        categories: [],
        topMerchants: [],
      };
    }

    // Filter transactions by date range
    const filteredTransactions = filterTransactionsByDateRange(allTimeTransactions, dateRange);
    
    // Calculate metrics from filtered transactions (primary source of truth)
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

  // Update analytics display state when filtered data changes (single source of truth)
  useEffect(() => {
    // Only update state if values have actually changed to prevent unnecessary re-renders
    setMonthSpend(prev => prev !== filteredData.totalSpending ? filteredData.totalSpending : prev);
    
    // For arrays/objects, compare JSON strings for deep equality
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

  // Consolidated transaction tab management (debounced search)
  useEffect(() => {
    // Early return if not on transactions tab
    if (tab !== 'transactions') {
      return;
    }

    // Always reset to first page when entering transactions tab or debounced search changes
    setCurrentPage(1);

    // If base data has never been loaded, fetch once
    if (allTimeTransactionsRef.current.length === 0) {
      loadTransactions();
      return; // Don't update transactions until data is loaded
    }

    // Update displayed transactions based on debounced search term
    updateTransactions(debouncedSearch !== '' ? debouncedSearch : undefined);
  }, [tab, debouncedSearch, loadTransactions, updateTransactions]);

  // Clamp page number if transaction count changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(txns.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [txns.length, currentPage]);

  // Re-apply category filter when selection changes
  useEffect(() => {
    // Only adjust when on transactions tab
    if (tab !== 'transactions') return;
    setCurrentPage(1);
    setTxns(applyCategoryFilter(baseTxns, selectedCategory));
  }, [selectedCategory, baseTxns, tab, applyCategoryFilter]);

  // Reset category filter when navigating between tabs
  useEffect(() => {
    setSelectedCategory(null);
  }, [tab]);

  // Available category options based on the base (search-filtered) list
  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of baseTxns) {
      const name = t.category?.name || 'Uncategorized';
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [baseTxns]);

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
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Dashboard</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Overview of balances, spending, and recent trends.</p>
                </div>
                {/* Balances Overview (visibility controls floating time bar) */}
                <div ref={balancesOverviewRef}>
                  <BalancesOverview />
                </div>
                
                <div ref={spendingOverviewRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  <Card className="h-full">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">Spending</div>
                    {isLoadingAnalytics && (
                      <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">Loading analytics...</div>
                    )}
                    <div className="group relative flex items-center justify-center py-2">
                      <div className="relative w-[260px] h-[260px]">
                        {byCat.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  dataKey="value"
                                  data={byCat}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={120}
                                  innerRadius={70}
                                  stroke="none"
                                  paddingAngle={1}
                                  nameKey="name"
                                  isAnimationActive={true}
                                  animationBegin={0}
                                  animationDuration={800}
                                >
                                  {byCat.map((cat, index) => {
                                    const color = getChartColorArray(dark)[index % getChartColorArray(dark).length];
                                    const isHovered = hoveredCategory === cat.name;
                                    return (
                                      <Cell
                                        key={`cell-${cat.name}`}
                                        fill={color}
                                        stroke={isHovered ? (dark ? '#f8fafc' : '#1e293b') : 'none'}
                                        strokeWidth={isHovered ? 3 : 0}
                                        onMouseEnter={() => setHoveredCategory(cat.name)}
                                        onMouseLeave={() => setHoveredCategory(null)}
                                        style={{
                                          filter: isHovered ? 'brightness(1.15) saturate(1.1)' : 'none',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease'
                                        }}
                                      />
                                    );
                                  })}
                                </Pie>
                                <Tooltip 
                                  contentStyle={getTooltipStyle(dark)}
                                  itemStyle={{ color: dark ? '#ffffff' : '#0f172a' }}
                                  labelStyle={{ color: dark ? '#ffffff' : '#0f172a' }}
                                  formatter={(value: any, _name: any, props: any) => [fmtUSD(Number(value)), props?.payload?.name || '']}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{fmtUSD(monthSpend)}</div>
                            </div>
                            {/* Removed Other Categories hover panel; rely on tooltip only */}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <div className="text-6xl mb-2 opacity-30">📊</div>
                              <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-1">No transactions found</div>
                              <div className="text-sm text-slate-500 dark:text-slate-500">No transaction data available</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Top Categories inside the card (2 per row) */}
                    <div className="mt-4">
                      {(() => {
                        const categories = filteredData.categories as { name: string; value: number }[];
                        if (!categories || categories.length === 0) return null;
                        const categorySum = categories.reduce((sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0), 0);
                        const top = categories.slice(0, 4);
                        return (
                          <div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">Top Categories</div>
                            <div className="grid grid-cols-2 gap-2">
                            {top.map((cat, idx) => {
                              const percentage = categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0';
                              const color = getChartColorArray(dark)[idx % getChartColorArray(dark).length];
                              const isHovered = hoveredCategory === cat.name;
                              return (
                                <div
                                  key={`topcard-${cat.name}`}
                                  className={`p-2 rounded-lg border transition-all ${
                                    isHovered ? 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                  onMouseEnter={() => setHoveredCategory(cat.name)}
                                  onMouseLeave={() => setHoveredCategory(null)}
                                >
                                  {/* Name row */}
                                  <div className="flex items-center gap-2 min-w-0 mb-1">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                                  </div>
                                  {/* Amount + percentage row */}
                                  <div className="flex items-baseline justify-between">
                                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{fmtUSD(cat.value)}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{percentage}%</div>
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Card>
                  <Card className="h-full">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-medium">Top Merchants</div>
                    <div className="space-y-3">
                      {topMerchants.length > 0 ? (
                        topMerchants.map((merchant, index) => (
                          <div key={merchant.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-900 text-xs font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{merchant.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {merchant.count} transaction{merchant.count !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtUSD(merchant.amount)}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{merchant.percentage}%</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <div className="text-sm">No merchants found for this period</div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="h-full">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">Net Worth Over Time</div>
                    {netLoading ? (
                      <div className="h-40 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
                    ) : netError ? (
                      <div className="text-sm text-rose-600 dark:text-rose-400">{netError}</div>
                    ) : netSeries.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No data for this range.</div>
                    ) : (
                      <div className="w-full overflow-hidden" style={{ height: 'clamp(240px, 36vh, 28rem)' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={netSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#94a3b8", fontSize: 12 }}
                              interval="preserveStartEnd"
                              minTickGap={24}
                              tickFormatter={(value: string) => {
                                // Smart, compact date labels based on visible span
                                try {
                                  if (!value) return ''
                                  const first = netSeries[0]?.date
                                  const last = netSeries[netSeries.length - 1]?.date
                                  const d = new Date(value)
                                  const spanDays = first && last
                                    ? Math.max(1, Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000))
                                    : 0
                                  if (!isFinite(d.getTime())) return value
                                  if (spanDays && spanDays <= 92) {
                                    // Up to ~3 months → "MMM d"
                                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  }
                                  if (spanDays && spanDays <= 400) {
                                    // ~1 year window → include year on all ticks with apostrophe
                                    const mm = d.toLocaleString('en-US', { month: 'short' })
                                    const yy = d.toLocaleString('en-US', { year: '2-digit' })
                                    return `${mm} ’${yy}`
                                  }
                                  // >1 year → always include 2-digit year with apostrophe
                                  {
                                    const mm = d.toLocaleString('en-US', { month: 'short' })
                                    const yy = d.toLocaleString('en-US', { year: '2-digit' })
                                    return `${mm} ’${yy}`
                                  }
                                } catch {
                                  return value
                                }
                              }}
                            />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => {
                              const n = Math.abs(Number(v));
                              const s = Number(v) < 0 ? '-' : '';
                              if (n >= 1e9) return s + '$' + (n/1e9).toFixed(0) + 'B';
                              if (n >= 1e6) return s + '$' + (n/1e6).toFixed(0) + 'M';
                              if (n >= 1e3) return s + '$' + (n/1e3).toFixed(0) + 'k';
                              return fmtUSD(v as number).replace(/\.00$/, '');
                            }} />
                            <Tooltip contentStyle={getTooltipStyle(dark)} formatter={(v: any) => [fmtUSD(v), 'Net']} labelFormatter={l => l} />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#10b981"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#netGradient)"
                              dot={netDotRenderer as any}
                              activeDot={{ r: 6 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                </div>

                
              </div>
            )}

            {tab === "transactions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Transactions</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Search, filter, and review all your transactions.</p>
                  </div>
                  <div className="relative w-full max-w-sm">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" className="w-full pl-3 pr-3 py-2 rounded-2xl bg-white/10 border border-white/15 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-1">
                  {categoryOptions.map((name, idx) => {
                    const isSelected = selectedCategory === name;
                    // Standardized category color mapping by name hash
                    const theme = getTagThemeForCategory(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedCategory(isSelected ? null : name)}
                        className="transition-all"
                        title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs ${theme.tag} ${isSelected ? `ring-2 ${theme.ring}` : 'hover:brightness-110'}`}
                          style={isSelected ? { boxShadow: `0 0 0 3px ${theme.ringHex}40` } : undefined}
                        >
                          ● {name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Card className="p-0 overflow-hidden">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Loading transactions...</div>
                        <div className="text-sm text-slate-500 dark:text-slate-500">
                          Fetching data from server
                        </div>
                      </div>
                    </div>
                  ) : txns.length > 0 ? (
                    (() => {
                      const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
                      const start = (currentPage - 1) * pageSize;
                      const pageItems = sorted.slice(start, start + pageSize);
                      const from = Math.min(sorted.length, start + 1);
                      const to = Math.min(sorted.length, start + pageSize);

                      return (
                        <>
                          <table className="min-w-full text-sm table-fixed">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                              <tr>
                                <Th className="w-[15%] whitespace-nowrap">Date</Th>
                                <Th className="w-[30%]">Merchant</Th>
                                <Th className="w-[15%] text-right whitespace-nowrap">Amount</Th>
                                <Th className="w-[20%] whitespace-nowrap">Account</Th>
                                <Th className="w-[20%] whitespace-nowrap">Category</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageItems.map((r, i) => (
                                <tr key={r.id} className={`border-b border-slate-200 dark:border-slate-700 ${i % 2 ? "bg-slate-50 dark:bg-slate-700/50" : ""}`}>
                                  <Td className="whitespace-nowrap align-middle">{new Date(r.date).toLocaleDateString()}</Td>
                                  <Td className="truncate align-middle" title={r.name || r.merchant || "-"}>
                                    <span className="block truncate">{r.name || r.merchant || "-"}</span>
                                  </Td>
                                  <Td className={`text-right tabular-nums whitespace-nowrap font-medium align-middle ${
                                    r.amount > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : r.amount < 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-slate-600 dark:text-slate-400'
                                  }`}>{fmtUSD(r.amount)}</Td>
                                  <Td className="whitespace-nowrap align-middle">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                      {r.account_name}
                                      {r.account_mask && (
                                        <span className="text-slate-400 dark:text-slate-500 ml-1">
                                          ••••{r.account_mask}
                                        </span>
                                      )}
                                    </span>
                                  </Td>
                                  <Td className="whitespace-nowrap align-middle">
                                    {(() => {
                                      const catName = r.category?.name || 'Uncategorized';
                                      const theme = getTagThemeForCategory(catName);
                                      return (
                                        <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs ${theme.tag}`}>
                                          ● {catName}
                                        </span>
                                      );
                                    })()}
                                  </Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-xs text-slate-600 dark:text-slate-400">Showing {from}-{to} of {sorted.length}</div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              >
                                Previous
                              </button>
                              <div className="text-xs text-slate-600 dark:text-slate-400">Page {currentPage} of {totalPages}</div>
                              <button
                                className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <div className="text-6xl mb-4 opacity-30">📋</div>
                        <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No transactions found</div>
                        <div className="text-sm text-slate-500 dark:text-slate-500">
                          {search ? `No transactions match "${search}"` : 'No transaction data available'}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {tab === "budgets" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Budgets</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Plan monthly spending and track progress by category.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {budgetsMonthLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setBudgetsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                          aria-label="Previous month"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Previous month"
                        >
                          <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setBudgetsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                          aria-label="Next month"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Next month"
                        >
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { const now = new Date(); setBudgetsMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium whitespace-nowrap shadow-sm bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600"
                          title="Jump to current month"
                        >
                          <CalendarIcon className="w-4 h-4" />
                          Today
                        </button>
                      </div>
                    </div>
                    {!isAddingBudget ? (
                      <button
                        onClick={startAddBudget}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 px-3 text-sm font-semibold text-white shadow whitespace-nowrap"
                      >
                        <Plus className="h-4 w-4" />
                        Add budget
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          data-testid="budget-category-select"
                          value={budgetFormCategory}
                          onChange={e => setBudgetFormCategory(e.target.value)}
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        >
                          <option value="" disabled>Select category</option>
                          {allCategoryIds.map(cat => (
                            <option key={cat} value={cat} disabled={usedBudgetCategories.has(cat)}>
                              {formatCategoryName(cat)}{usedBudgetCategories.has(cat) ? ' (used)' : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          data-testid="budget-amount-input"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Amount"
                          value={budgetFormAmount}
                          onChange={e => setBudgetFormAmount(e.target.value)}
                          className="w-28 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        />
                        <button data-testid="budget-save" onClick={submitAddBudget} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white inline-flex items-center gap-1">
                          <CheckIcon className="w-4 h-4" />
                          Save
                        </button>
                        <button onClick={cancelBudgetEdit} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 inline-flex items-center gap-1">
                          <XMarkIcon className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                

                <Card className="p-0 overflow-hidden">
                  {budgetsComputed.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-3">
                      {budgetsComputed.map((b) => {
                        const isOverBudget = (b as any).spent > b.amount;
                        const percent = (b as any).percentage || 0;
                        const tagTheme = getTagThemeForCategory(formatCategoryName(b.category));
                        const isEditing = editingBudgetId === b.id;
                        return (
                          <li
                            key={b.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 transition
                            hover:border-sky-300 dark:hover:border-sky-500 hover:ring-2 hover:ring-sky-400/50 dark:hover:ring-sky-500/40
                            focus-within:ring-2 focus-within:ring-sky-400/50 dark:focus-within:ring-sky-500/40"
                          >
                            <div className="flex items-start justify-between">
                              <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs ${tagTheme.tag}`}>
                                ● {formatCategoryName(b.category)}
                              </div>
                              <div className="flex gap-2 text-xs">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => submitEditBudget(b.id)}
                                      title="Save"
                                      aria-label="Save budget"
                                      className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                      <CheckIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={cancelBudgetEdit}
                                      title="Cancel"
                                      aria-label="Cancel edit"
                                      className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                      <XMarkIcon className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditBudget(b)}
                                      title="Edit budget"
                                      aria-label="Edit budget"
                                      className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    >
                                      <PencilSquareIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteBudget(b.id)}
                                      title="Delete budget"
                                      aria-label="Delete budget"
                                      className="p-1.5 rounded-md border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                                    >
                                      <TrashSolidIcon className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              {isEditing ? (
                                <>
                                  <input
                                    data-testid="budget-amount-input"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={budgetFormAmount}
                                    onChange={e => setBudgetFormAmount(e.target.value)}
                                    className="w-28 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                  />
                                  <div className="text-sm text-slate-600 dark:text-slate-400">{fmtUSD((b as any).spent)}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-lg">{fmtUSD(b.amount)}</div>
                                  <div className={`text-sm font-medium ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{fmtUSD((b as any).spent)}</div>
                                </>
                              )}
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-600">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                              {percent.toFixed(0)}% used {isOverBudget && (
                                <span className="text-red-500 dark:text-red-400 ml-1">({fmtUSD((b as any).spent - b.amount)} over)</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-center py-16 px-3" data-testid="budgets-empty-state">
                      <div className="text-6xl mb-4 opacity-30">💰</div>
                      <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No budgets found</div>
                      <div className="text-sm text-slate-500 dark:text-slate-500">Add a budget to get started</div>
                    </div>
                  )}
                </Card>
              </div>
            )}

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

          {/* Floating time bar for Dashboard (animated) */}
          <AnimatePresence>
            {tab === 'dashboard' && showTimeBar && (
              <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center">
                <motion.div
                  key="dashboard-time-bar"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div className="flex gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 shadow-xl backdrop-blur-md ring-1 ring-slate-200/60 dark:ring-slate-700/60">
                  {[
                    { key: "current-month", label: "Current Month" },
                    { key: "past-2-months", label: "2 Months" },
                    { key: "past-3-months", label: "3 Months" },
                    { key: "past-6-months", label: "6 Months" },
                    { key: "past-year", label: "1 Year" },
                    { key: "all-time", label: "5 Years" }
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setDateRange(option.key as DateRange)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        dateRange === option.key
                          ? "bg-primary-100 dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow"
                          : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
