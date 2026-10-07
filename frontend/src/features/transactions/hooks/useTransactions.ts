import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProviderAccount } from '../../../context/AccountFilterContext';
import { type FilterCriteria, TransactionFilter } from '../../../domain/TransactionFilter';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { CategoryService } from '../../../services/CategoryService';
import { type TransactionFilters, TransactionService } from '../../../services/TransactionService';
import type { Transaction, UserCategory } from '../../../types/api';
import {
  formatCategoryName,
  getSubcategoriesForCategory,
  resolveMajorCategory,
} from '../../../utils/categories';
import {
  computeMonthRange,
  getCurrentMonthSelection,
  type MonthYearSelection,
} from '../../../utils/dateRanges';
import { getNetSpendingAmount } from '../../../utils/transactionAmounts';

export interface UseTransactionsOptions {
  initialSearch?: string;
  initialCategory?: string | null;
  initialSubcategory?: string | null;
  period?: MonthYearSelection;
  setPeriod?: (period: MonthYearSelection) => void;
  initialAccountId?: string | null;
  pageSize?: number;
}

export interface UseTransactionsResult {
  isLoading: boolean;
  error: string | null;
  transactions: Transaction[];
  allTransactions: Transaction[];
  monthRange: { start: string; end: string };
  categories: string[];
  subcategories: string[];
  search: string;
  setSearch: (s: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  selectedSubcategory: string | null;
  setSelectedSubcategory: (s: string | null) => void;
  period: MonthYearSelection;
  setPeriod: (period: MonthYearSelection) => void;
  accountOptions: ProviderAccount[];
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string | null) => void;
  // pagination
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageItems: Transaction[];
  totalItems: number;
  totalPages: number;
  duplicateCandidateIds: string[];
  // category management
  userCategories: UserCategory[];
  markTransactionDuplicate: (transactionId: string) => Promise<void>;
  updateTransactionCategory: (
    transactionId: string,
    categoryName: string,
    subcategoryName?: string
  ) => Promise<void>;
  resetTransactionCategory: (transactionId: string) => Promise<void>;
  createCategoryAndAssign: (
    transactionId: string,
    name: string,
    parentCategory?: string
  ) => Promise<void>;
  createCategoryRule: (
    transactionId: string,
    pattern: string,
    categoryName: string,
    subcategoryName?: string
  ) => Promise<void>;
  deleteUserCategory: (categoryId: string) => Promise<void>;
  load: (isSilent?: boolean) => Promise<void>;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const {
    initialSearch = '',
    initialCategory = null,
    initialSubcategory = null,
    period: controlledPeriod,
    setPeriod: controlledSetPeriod,
    initialAccountId = null,
    pageSize = 10,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<Transaction[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(initialSubcategory);

  const setSelectedCategory = useCallback((category: string | null) => {
    setSelectedCategoryState(category);
    setSelectedSubcategory(null);
  }, []);

  const prevCategoryRef = useRef(selectedCategory);
  useEffect(() => {
    if (prevCategoryRef.current !== selectedCategory) {
      prevCategoryRef.current = selectedCategory;
      setSelectedSubcategory(null);
    }
  }, [selectedCategory]);

  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<MonthYearSelection>(() =>
    getCurrentMonthSelection()
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(initialAccountId);
  const [currentPage, setCurrentPage] = useState(1);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const period = controlledPeriod ?? uncontrolledPeriod;
  const setPeriod = controlledSetPeriod ?? setUncontrolledPeriod;
  const monthRange = useMemo(() => computeMonthRange(period), [period]);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    accountsByBank,
    loading: accountsLoading,
  } = useAccountFilter();

  const accountOptions = useMemo(
    () =>
      Object.values(accountsByBank)
        .flat()
        .filter((account) => account.provider_account_id || account.provider_connection_id)
        .sort((a, b) => {
          const bankCompare = a.institution_name.localeCompare(b.institution_name);
          return bankCompare !== 0 ? bankCompare : a.name.localeCompare(b.name);
        }),
    [accountsByBank]
  );

  const load = useCallback(
    async (isSilent = false) => {
      if (accountsLoading) {
        return;
      }
      if (!isSilent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const filters: TransactionFilters = {};
        if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
          setAll([]);
          return;
        }
        if (selectedAccountId) {
          filters.accountIds = [selectedAccountId];
        } else if (!isAllAccountsSelected && selectedAccountIds.length > 0) {
          filters.accountIds = selectedAccountIds;
        }
        filters.startDate = monthRange.start;
        filters.endDate = monthRange.end;
        const txns = await TransactionService.getTransactions(filters);
        setAll(txns);
      } catch (error: unknown) {
        const status = getStatus(error);
        const msg =
          status === 401
            ? 'You are not authenticated. Please log in again.'
            : 'Failed to load transactions.';
        setError(msg);
        setAll([]);
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [
      accountsLoading,
      isAllAccountsSelected,
      selectedAccountIds,
      selectedAccountId,
      allAccountIds,
      monthRange.start,
      monthRange.end,
    ]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    CategoryService.getCategories()
      .then(setUserCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setSelectedCategory(initialCategory);
    setSelectedSubcategory(null);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedSubcategory(initialSubcategory);
  }, [initialSubcategory]);

  useEffect(() => {
    setSelectedAccountId(initialAccountId);
  }, [initialAccountId]);

  const updateTransactionCategory = useCallback(
    async (transactionId: string, categoryName: string, subcategoryName?: string) => {
      await CategoryService.setTransactionCategory(transactionId, categoryName, subcategoryName);
      setAll((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                custom_category: categoryName,
                custom_subcategory: subcategoryName,
                category: {
                  ...t.category,
                  primary: categoryName,
                  ...(subcategoryName ? { detailed: subcategoryName } : {}),
                },
              }
            : t
        )
      );
    },
    []
  );

  const resetTransactionCategory = useCallback(
    async (transactionId: string) => {
      await CategoryService.removeTransactionCategory(transactionId);
      // Reload silently so provider/rule category is restored without unmounting
      await load(true);
    },
    [load]
  );

  const createCategoryAndAssign = useCallback(
    async (transactionId: string, name: string, parentCategory?: string) => {
      const created = await CategoryService.createCategory(name, parentCategory);
      setUserCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      const majorCat = parentCategory || 'Shopping';
      await CategoryService.setTransactionCategory(transactionId, majorCat, name);
      setAll((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                custom_category: majorCat,
                custom_subcategory: name,
                category: {
                  ...t.category,
                  primary: majorCat,
                  detailed: name,
                },
              }
            : t
        )
      );
    },
    []
  );

  const createCategoryRule = useCallback(
    async (
      transactionId: string,
      pattern: string,
      categoryName: string,
      subcategoryName?: string
    ) => {
      // Optimistically update matching transactions in state immediately
      setAll((prev) =>
        prev.map((t) => {
          const merchant = t.merchant || t.name || '';
          const isTarget = t.id === transactionId;
          const isMatch = matchGlob(pattern, merchant);
          if (isTarget || (!t.custom_category && isMatch)) {
            return {
              ...t,
              custom_category: undefined,
              custom_subcategory: undefined,
              rule_category: categoryName,
              rule_subcategory: subcategoryName,
              category: {
                ...t.category,
                primary: categoryName,
                ...(subcategoryName ? { detailed: subcategoryName } : {}),
              },
            };
          }
          return t;
        })
      );

      await CategoryService.createRule(pattern, categoryName, subcategoryName);
      if (transactionId) {
        try {
          await CategoryService.removeTransactionCategory(transactionId);
        } catch {
          // Ignore if no override existed
        }
      }
      // Silently reload in background so backend glob matching is synced without unmounting the table
      await load(true);
    },
    [load]
  );

  const deleteUserCategory = useCallback(
    async (categoryId: string) => {
      await CategoryService.deleteCategory(categoryId);
      setUserCategories((prev) => prev.filter((c) => c.id !== categoryId));
      // Reload transactions — backend clears overrides that used this category
      await load();
    },
    [load]
  );

  const markTransactionDuplicate = useCallback(async (transactionId: string) => {
    await TransactionService.markDuplicate(transactionId);
    setAll((prev) => prev.filter((t) => t.id !== transactionId));
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  const resolveCategoryLabel = useCallback((t: Transaction) => {
    if (!t.category?.primary) {
      return 'Shopping';
    }
    return resolveMajorCategory(t.category.primary);
  }, []);

  const resolveSubcategoryLabel = useCallback((t: Transaction) => {
    return t.category?.detailed || t.custom_subcategory || t.rule_subcategory || '';
  }, []);

  const categoryOptionItems = useMemo(() => {
    const criteria: FilterCriteria = {
      search: debouncedSearch.trim(),
      dateRange: { start: monthRange.start, end: monthRange.end },
    };
    return TransactionFilter.filter(all, criteria).filter((transaction) => {
      return getNetSpendingAmount(transaction) !== 0;
    });
  }, [all, debouncedSearch, monthRange.start, monthRange.end]);

  const filtered = useMemo(() => {
    const criteria: FilterCriteria = {
      search: debouncedSearch.trim(),
      category: selectedCategory || undefined,
      subcategory: selectedSubcategory || undefined,
      dateRange: { start: monthRange.start, end: monthRange.end },
    };
    const result = TransactionFilter.filter(all, criteria);
    if (!selectedCategory && !selectedSubcategory) {
      return result;
    }
    return result.filter((transaction) => getNetSpendingAmount(transaction) !== 0);
  }, [
    all,
    debouncedSearch,
    selectedCategory,
    selectedSubcategory,
    monthRange.start,
    monthRange.end,
  ]);

  const availableCategories = useMemo(() => {
    const names = new Set<string>();
    for (const t of categoryOptionItems) {
      const name = resolveCategoryLabel(t) || 'Shopping';
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categoryOptionItems, resolveCategoryLabel]);

  const categories = useMemo(() => {
    return availableCategories;
  }, [availableCategories]);

  const subcategories = useMemo(() => {
    if (selectedCategory) {
      const allSubs = getSubcategoriesForCategory(selectedCategory, userCategories);
      const validSubMap = new Map<string, string>();
      for (const s of allSubs) {
        validSubMap.set(s.toLowerCase(), s);
      }
      const selectedCatLower = selectedCategory.trim().toLowerCase();

      const txnSubs = new Set<string>();
      for (const t of categoryOptionItems) {
        const cat = resolveCategoryLabel(t);
        if (cat.toLowerCase() === selectedCatLower) {
          const sub = resolveSubcategoryLabel(t);
          if (sub) {
            const canonical = validSubMap.get(sub.toLowerCase());
            if (canonical) {
              txnSubs.add(canonical);
            }
          }
        }
      }
      const result: string[] = [];
      for (const sub of txnSubs) {
        result.push(sub);
      }
      for (const sub of allSubs) {
        if (!result.includes(sub)) {
          result.push(sub);
        }
      }
      return result;
    }

    const names = new Set<string>();
    for (const t of categoryOptionItems) {
      const cat = resolveCategoryLabel(t);
      const sub = resolveSubcategoryLabel(t);
      if (
        sub &&
        sub.toLowerCase() !== 'other' &&
        !sub.toLowerCase().startsWith('other ') &&
        (cat ? cat.toLowerCase() === 'groceries' || sub.toLowerCase() !== cat.toLowerCase() : true)
      ) {
        names.add(sub);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [
    selectedCategory,
    userCategories,
    categoryOptionItems,
    resolveCategoryLabel,
    resolveSubcategoryLabel,
  ]);

  useEffect(() => {
    if (
      selectedCategory &&
      !isLoading &&
      availableCategories.length > 0 &&
      !availableCategories.some((c) => c.toLowerCase() === selectedCategory.toLowerCase())
    ) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    }
  }, [availableCategories, isLoading, selectedCategory]);

  useEffect(() => {
    if (
      selectedAccountId &&
      accountOptions.length > 0 &&
      !accountOptions.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(null);
    }
  }, [accountOptions, selectedAccountId]);

  const duplicateCandidateIds = useMemo(() => {
    const candidateIds = new Set<string>();

    for (const transaction of filtered) {
      const amount = Number(transaction.amount);
      if (!transaction.account_id || amount === 0) {
        continue;
      }

      const hasPostedMatch = filtered.some((candidate) => {
        if (candidate.id === transaction.id || candidate.pending) {
          return false;
        }
        return areDuplicateCandidates(transaction, candidate);
      });

      if (transaction.pending && hasPostedMatch) {
        candidateIds.add(transaction.id);
      }
    }

    return Array.from(candidateIds);
  }, [filtered]);

  const activeTransactions = useMemo(() => {
    const duplicateSet = new Set(duplicateCandidateIds);
    return filtered.filter((t) => !duplicateSet.has(t.id));
  }, [filtered, duplicateCandidateIds]);

  const totalItems = activeTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (currentPage - 1) * pageSize;
  const pageItems = useMemo(() => {
    return activeTransactions.slice(start, start + pageSize);
  }, [activeTransactions, start, pageSize]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: specific filters should reset pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedCategory,
    selectedSubcategory,
    debouncedSearch,
    period,
    selectedAccountIds,
    selectedAccountId,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return {
    isLoading,
    error,
    transactions: activeTransactions,
    allTransactions: all,
    monthRange,
    categories,
    subcategories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
    period,
    setPeriod,
    accountOptions,
    selectedAccountId,
    setSelectedAccountId,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
    duplicateCandidateIds,
    userCategories,
    markTransactionDuplicate,
    updateTransactionCategory,
    resetTransactionCategory,
    createCategoryAndAssign,
    createCategoryRule,
    deleteUserCategory,
    load,
  };
}

function areDuplicateCandidates(a: Transaction, b: Transaction): boolean {
  const amountA = Number(a.amount);
  const amountB = Number(b.amount);

  return (
    Boolean(a.account_id) &&
    a.account_id === b.account_id &&
    amountA !== 0 &&
    amountA.toFixed(2) === amountB.toFixed(2) &&
    daysBetween(a.date, b.date) <= 7 &&
    merchantsLookRelated(a.merchant || a.name, b.merchant || b.name)
  );
}

function daysBetween(a: string, b: string): number {
  const dateA = Date.parse(`${a}T00:00:00Z`);
  const dateB = Date.parse(`${b}T00:00:00Z`);
  return Math.abs(dateA - dateB) / 86_400_000;
}

function merchantsLookRelated(a: string | undefined, b: string | undefined): boolean {
  const merchantA = normalizeMerchant(a);
  const merchantB = normalizeMerchant(b);
  if (!merchantA || !merchantB) return false;
  if (merchantA === merchantB || merchantA.includes(merchantB) || merchantB.includes(merchantA)) {
    return true;
  }
  if (merchantA.length >= 6 && merchantB.includes(merchantA.slice(0, 6))) return true;
  if (merchantB.length >= 6 && merchantA.includes(merchantB.slice(0, 6))) return true;

  const tokensA = tokenizeMerchant(a);
  const tokensB = tokenizeMerchant(b);
  for (const token of tokensA) {
    if (tokensB.has(token)) return true;
  }
  return false;
}

function tokenizeMerchant(value: string | undefined): Set<string> {
  const stopWords = new Set([
    'purchase',
    'payment',
    'payments',
    'authorized',
    'recurring',
    'card',
    'draft',
    'entry',
    'descr',
    'pmts',
    'mktplace',
    'mktpl',
  ]);
  const tokens = new Set<string>();
  const matches = (value || '').toLowerCase().match(/[a-z0-9]{3,}/g);
  if (matches) {
    for (const m of matches) {
      if (!stopWords.has(m)) {
        tokens.add(m);
      }
    }
  }
  return tokens;
}

function normalizeMerchant(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setV(value), delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, delay]);
  return v;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function matchGlob(pattern: string, text: string): boolean {
  if (!pattern || !text) return false;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(text);
}
