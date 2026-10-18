import {
  AlertTriangle,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProviderAccount } from '@/context/AccountFilterContext';
import { Alert, Button, cn, FormLabel, GlassCard, Input, Modal } from '@/ui/primitives';
import MonthYearSelector from '../components/MonthYearSelector';
import HeroStatCard from '../components/widgets/HeroStatCard';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import CategoryRulesModal from '../features/transactions/components/CategoryRulesModal';
import TransactionsFilters from '../features/transactions/components/TransactionsFilters';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import { useCurrency } from '../hooks/useCurrency';
import { PageLayout } from '../layouts/PageLayout';
import { BudgetService } from '../services/BudgetService';
import { type TransactionFilters, TransactionService } from '../services/TransactionService';
import type { Budget, BudgetFrequency, Transaction } from '../types/api';
import {
  CATEGORIES_TAXONOMY,
  formatCategoryName,
  getMajorCategoryForSubcategory,
  isSpendingExcludedCategory,
  resolveMajorCategory,
} from '../utils/categories';
import type { MonthYearSelection } from '../utils/dateRanges';
import {
  getDisplayAmount,
  getNetSpendingAmount,
  isSpendingTransaction,
} from '../utils/transactionAmounts';

interface TransactionsPageProps {
  initialAccountId?: string | null;
  initialCategory?: string | null;
  period: MonthYearSelection;
  onPeriodChange: (period: MonthYearSelection) => void;
}

const formatAccountOptionLabel = (account: ProviderAccount) => {
  return account.name;
};

const formatAccountOptionTitle = (account: ProviderAccount) => {
  const mask = account.mask ? ` • ${account.mask}` : '';
  return `${account.institution_name} - ${account.name}${mask}`;
};

const TransactionsPage: React.FC<TransactionsPageProps> = ({
  initialAccountId = null,
  initialCategory = null,
  period,
  onPeriodChange,
}) => {
  const { format } = useCurrency();
  const {
    isLoading,
    error,
    transactions,
    allTransactions,
    monthRange,
    categories,
    subcategories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
    period: selectedPeriod,
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
    load: reloadTransactions,
  } = useTransactions({
    pageSize: 8,
    initialAccountId,
    initialCategory,
    period,
    setPeriod: onPeriodChange,
  });

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleCreateCategoryRule = useCallback(
    async (
      transactionId: string,
      pattern: string,
      categoryName: string,
      subcategoryName?: string
    ) => {
      await createCategoryRule(transactionId, pattern, categoryName, subcategoryName);
      setToastMessage(`Auto-rule "${pattern}" saved successfully`);
    },
    [createCategoryRule]
  );

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ytdTransactions, setYtdTransactions] = useState<Transaction[]>([]);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetModalCategory, setBudgetModalCategory] = useState<string>('');
  const [budgetDraftAmount, setBudgetDraftAmount] = useState<string>('');
  const [budgetDraftFrequency, setBudgetDraftFrequency] = useState<BudgetFrequency>('monthly');
  const [budgetDraftRollover, setBudgetDraftRollover] = useState<boolean>(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    try {
      const list = await BudgetService.getBudgets();
      setBudgets(list);
    } catch (err) {
      console.error('Failed to load budgets', err);
    }
  }, []);

  useEffect(() => {
    void loadBudgets();
  }, [loadBudgets]);

  const loadYtdTransactions = useCallback(async () => {
    try {
      const filters: TransactionFilters = {
        startDate: `${period.year}-01-01`,
        endDate: monthRange.end,
      };
      if (selectedAccountId) {
        filters.accountIds = [selectedAccountId];
      }
      const txns = await TransactionService.getTransactions(filters);
      setYtdTransactions(txns);
    } catch (err) {
      console.error('Failed to load YTD transactions', err);
    }
  }, [period.year, monthRange.end, selectedAccountId]);

  useEffect(() => {
    void loadYtdTransactions();
  }, [loadYtdTransactions]);

  const effectiveYtdTransactions = useMemo(() => {
    return ytdTransactions.length > 0 ? ytdTransactions : allTransactions;
  }, [ytdTransactions, allTransactions]);

  const matchedBudget = useMemo(() => {
    if (selectedSubcategory) {
      const targetSub = selectedSubcategory.trim().toLowerCase();
      return budgets.find((b) => b.category.trim().toLowerCase() === targetSub) ?? null;
    }
    if (selectedCategory) {
      const targetCat = selectedCategory.trim().toLowerCase();
      return budgets.find((b) => b.category.trim().toLowerCase() === targetCat) ?? null;
    }
    return null;
  }, [budgets, selectedCategory, selectedSubcategory]);

  const activeRolloverData = useMemo(() => {
    if (!matchedBudget) return null;
    return BudgetCalculator.computeRolloverBudget(
      matchedBudget,
      effectiveYtdTransactions,
      period,
      selectedSubcategory
    );
  }, [matchedBudget, effectiveYtdTransactions, period, selectedSubcategory]);

  const compositeMajorData = useMemo(() => {
    if (!selectedCategory || selectedSubcategory) return null;

    const normMajor = selectedCategory.trim().toLowerCase();
    const directBudget = budgets.find((b) => b.category.trim().toLowerCase() === normMajor) ?? null;

    const subcategoryBudgets = budgets
      .filter((b) => {
        const bCat = b.category.trim().toLowerCase();
        if (bCat === normMajor) return false;
        const parent =
          getMajorCategoryForSubcategory(b.category, userCategories) ||
          resolveMajorCategory(b.category);
        return parent && parent.toLowerCase() === normMajor;
      })
      .map((b) => ({
        subcategory: b.category,
        budget: b,
      }));

    if (!directBudget && subcategoryBudgets.length === 0) {
      return null;
    }

    return BudgetCalculator.computeCompositeMajorBudget(
      selectedCategory,
      directBudget,
      subcategoryBudgets,
      effectiveYtdTransactions,
      period
    );
  }, [
    budgets,
    selectedCategory,
    selectedSubcategory,
    userCategories,
    effectiveYtdTransactions,
    period,
  ]);

  const categorySpent = useMemo(() => {
    const target = selectedSubcategory || selectedCategory;
    if (!target) return 0;
    return BudgetCalculator.calculateSpent(
      allTransactions,
      target,
      monthRange.start,
      monthRange.end,
      selectedSubcategory
    );
  }, [allTransactions, selectedCategory, selectedSubcategory, monthRange.start, monthRange.end]);

  const categoryYtdSpent = useMemo(() => {
    const target = selectedSubcategory || selectedCategory;
    if (!target) return 0;
    return BudgetCalculator.calculateSpent(
      effectiveYtdTransactions,
      target,
      `${period.year}-01-01`,
      monthRange.end,
      selectedSubcategory
    );
  }, [
    effectiveYtdTransactions,
    selectedCategory,
    selectedSubcategory,
    period.year,
    monthRange.end,
  ]);

  const totalBudgeted = useMemo(() => {
    const isFullYear = period.month === null;
    return budgets.reduce((sum, b) => {
      const freq = b.frequency || 'monthly';
      const multiplier = isFullYear
        ? freq === 'quarterly'
          ? 4
          : freq === 'semi_annual'
            ? 2
            : freq === 'annual'
              ? 1
              : 12
        : 1;
      return sum + b.amount * multiplier;
    }, 0);
  }, [budgets, period.month]);

  const totalBudgetSpent = useMemo(() => {
    const countedIds = new Set<string>();
    let total = 0;

    for (const t of allTransactions) {
      const primary = t.category?.primary || '';
      if (isSpendingExcludedCategory(primary)) continue;
      const dateString = new Date(t.date).toISOString().slice(0, 10);
      if (dateString < monthRange.start || dateString > monthRange.end) continue;

      const isBudgeted = budgets.some((b) => {
        return (
          BudgetCalculator.calculateSpent([t], b.category, monthRange.start, monthRange.end) !== 0
        );
      });

      if (isBudgeted && !countedIds.has(t.id)) {
        countedIds.add(t.id);
        total += getNetSpendingAmount(t);
      }
    }
    return total;
  }, [allTransactions, budgets, monthRange.start, monthRange.end]);

  const rolloverCount = useMemo(() => {
    return budgets.filter((b) => b.rollover).length;
  }, [budgets]);

  const budgetCardData = useMemo(() => {
    // 1. If viewing a subcategory: strict isolation
    if (selectedSubcategory) {
      const targetLabel = formatCategoryName(selectedSubcategory);
      const isFullYear = period.month === null;
      if (!matchedBudget) {
        return {
          title: `Budget · ${targetLabel}`,
          value: 'No budget',
          suffix: undefined,
          subtext: isFullYear
            ? `${format(categorySpent)} in ${period.year}`
            : `${format(categorySpent)} this mo • ${format(categoryYtdSpent)} YTD`,
          pills: [
            {
              label: 'Set budget',
              type: 'semantic' as const,
              tone: 'info' as const,
            },
          ],
          accent: 'slate' as const,
        };
      }

      if (activeRolloverData?.rollover) {
        const available = activeRolloverData.availableThisMonth;
        const carryover = activeRolloverData.priorCarryover;
        const remaining = activeRolloverData.remainingThisMonth;
        const isOver = activeRolloverData.isOverBudget;
        const percent = activeRolloverData.percentageUsed;
        const freqBadge =
          activeRolloverData.frequency === 'semi_annual'
            ? 'Twice / yr'
            : activeRolloverData.frequency === 'quarterly'
              ? 'Every 3 mos'
              : activeRolloverData.frequency === 'annual'
                ? 'Yearly'
                : 'Monthly';

        return {
          title: `Budget · ${targetLabel}`,
          value: format(available),
          suffix: carryover > 0 ? `(+${format(carryover)} roll)` : undefined,
          subtext: isFullYear
            ? `${format(activeRolloverData.monthSpent)} in ${period.year}`
            : `${format(activeRolloverData.monthSpent)} this mo • ${format(activeRolloverData.ytdSpent)} YTD`,
          pills: [
            ...(freqBadge !== 'Monthly'
              ? [
                  {
                    label: freqBadge,
                    type: 'semantic' as const,
                    tone: 'info' as const,
                  },
                ]
              : []),
            {
              label: 'Rollover',
              type: 'semantic' as const,
              tone: 'info' as const,
            },
            {
              label: isOver ? `${format(-remaining)} over` : `${format(remaining)} left`,
              type: 'semantic' as const,
              tone: isOver ? ('danger' as const) : ('success' as const),
            },
          ],
          accent: isOver
            ? ('rose' as const)
            : percent >= 85
              ? ('amber' as const)
              : ('emerald' as const),
        };
      }

      const remaining = matchedBudget.amount - categorySpent;
      const percent =
        matchedBudget.amount > 0 ? Math.round((categorySpent / matchedBudget.amount) * 100) : 0;
      const isOver = remaining < 0;
      const freq = matchedBudget.frequency || 'monthly';
      const freqBadge =
        freq === 'semi_annual'
          ? 'Twice / yr'
          : freq === 'quarterly'
            ? 'Every 3 mos'
            : freq === 'annual'
              ? 'Yearly'
              : 'Monthly';

      return {
        title: `Budget · ${targetLabel}`,
        value: format(matchedBudget.amount),
        suffix: undefined,
        subtext: `${format(categorySpent)} spent (${percent}%) • ${format(categoryYtdSpent)} YTD`,
        pills: [
          ...(freqBadge !== 'Monthly'
            ? [
                {
                  label: freqBadge,
                  type: 'semantic' as const,
                  tone: 'info' as const,
                },
              ]
            : []),
          {
            label: isOver ? `${format(-remaining)} over` : `${format(remaining)} left`,
            type: 'semantic' as const,
            tone: isOver ? ('danger' as const) : ('success' as const),
          },
        ],
        accent: isOver
          ? ('rose' as const)
          : percent >= 85
            ? ('amber' as const)
            : ('emerald' as const),
      };
    }

    // 2. If viewing a major category: composite including subcategories
    if (selectedCategory) {
      const targetLabel = formatCategoryName(selectedCategory);
      const isFullYear = period.month === null;
      if (!compositeMajorData) {
        return {
          title: `Budget · ${targetLabel}`,
          value: 'No budget',
          suffix: undefined,
          subtext: isFullYear
            ? `${format(categorySpent)} in ${period.year}`
            : `${format(categorySpent)} this mo • ${format(categoryYtdSpent)} YTD`,
          pills: [
            {
              label: 'Set budget',
              type: 'semantic' as const,
              tone: 'info' as const,
            },
          ],
          accent: 'slate' as const,
        };
      }

      const available = compositeMajorData.availableThisMonth;
      const carryover = compositeMajorData.totalPriorCarryover;
      const remaining = compositeMajorData.remainingThisMonth;
      const isOver = compositeMajorData.isOverBudget;
      const percent = compositeMajorData.percentageUsed;
      const subCount = compositeMajorData.subcategoryResults.length;

      return {
        title: `Budget · ${targetLabel}`,
        value: format(available),
        suffix: carryover > 0 ? `(+${format(carryover)} roll)` : undefined,
        subtext: isFullYear
          ? `${format(compositeMajorData.monthSpent)} in ${period.year} (${percent}%)`
          : `${format(compositeMajorData.monthSpent)} this mo (${percent}%) • ${format(compositeMajorData.ytdSpent)} YTD`,
        pills: [
          ...(subCount > 0
            ? [
                {
                  label: `Includes ${subCount} subcategory`,
                  type: 'semantic' as const,
                  tone: 'info' as const,
                },
              ]
            : []),
          ...(compositeMajorData.hasRollover
            ? [
                {
                  label: 'Rollover',
                  type: 'semantic' as const,
                  tone: 'info' as const,
                },
              ]
            : []),
          {
            label: isOver ? `${format(-remaining)} over` : `${format(remaining)} left`,
            type: 'semantic' as const,
            tone: isOver ? ('danger' as const) : ('success' as const),
          },
        ],
        accent: isOver
          ? ('rose' as const)
          : percent >= 85
            ? ('amber' as const)
            : ('emerald' as const),
      };
    }

    if (budgets.length === 0) {
      return {
        title: 'Budget',
        value: 'No budgets',
        suffix: undefined,
        subtext: 'Click to add a budget',
        pills: [
          {
            label: 'Add budget',
            type: 'semantic' as const,
            tone: 'info' as const,
          },
        ],
        accent: 'slate' as const,
      };
    }

    const remaining = totalBudgeted - totalBudgetSpent;
    const percent = totalBudgeted > 0 ? Math.round((totalBudgetSpent / totalBudgeted) * 100) : 0;
    const isOver = remaining < 0;

    return {
      title: 'Total Budget',
      value: format(totalBudgeted),
      suffix: undefined,
      subtext: `${format(totalBudgetSpent)} spent across ${budgets.length} budgets`,
      pills: [
        {
          label: isOver ? `${format(-remaining)} over` : `${format(remaining)} left`,
          type: 'semantic' as const,
          tone: isOver ? ('danger' as const) : ('success' as const),
        },
        ...(rolloverCount > 0
          ? [
              {
                label: `${rolloverCount} rollover`,
                type: 'semantic' as const,
                tone: 'info' as const,
              },
            ]
          : []),
      ],
      accent: isOver
        ? ('rose' as const)
        : percent >= 85
          ? ('amber' as const)
          : ('emerald' as const),
    };
  }, [
    selectedCategory,
    selectedSubcategory,
    matchedBudget,
    activeRolloverData,
    compositeMajorData,
    categorySpent,
    categoryYtdSpent,
    format,
    budgets.length,
    totalBudgeted,
    totalBudgetSpent,
    rolloverCount,
    period.month,
    period.year,
  ]);

  const handleOpenBudgetModal = (targetCategory?: string) => {
    const cat = targetCategory ?? selectedSubcategory ?? selectedCategory ?? '';
    setBudgetModalCategory(cat);
    setBudgetError(null);

    if (cat) {
      const targetCat = cat.trim().toLowerCase();
      const existing = budgets.find((b) => b.category.trim().toLowerCase() === targetCat);
      if (existing) {
        setBudgetDraftAmount(String(existing.amount));
        setBudgetDraftFrequency(existing.frequency || 'monthly');
        setBudgetDraftRollover(Boolean(existing.rollover));
      } else {
        setBudgetDraftAmount('');
        setBudgetDraftFrequency('monthly');
        setBudgetDraftRollover(false);
      }
    } else {
      setBudgetDraftAmount('');
      setBudgetDraftFrequency('monthly');
      setBudgetDraftRollover(false);
    }
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async () => {
    const amount = Number(budgetDraftAmount);
    if (!budgetModalCategory) {
      setBudgetError('Please select or specify a category.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError('Please enter a valid amount greater than 0.');
      return;
    }

    setBudgetSaving(true);
    setBudgetError(null);
    try {
      const targetCat = budgetModalCategory.trim().toLowerCase();
      const existing = budgets.find((b) => b.category.trim().toLowerCase() === targetCat);

      const currentPeriodStr =
        period.month === null
          ? `${period.year}-01`
          : `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
      const rolloverStart = budgetDraftRollover
        ? existing?.rollover_start_month || currentPeriodStr
        : undefined;

      if (existing) {
        await BudgetService.updateBudget(existing.id, {
          amount,
          frequency: budgetDraftFrequency,
          rollover: budgetDraftRollover,
          rollover_start_month: rolloverStart,
        });
      } else {
        await BudgetService.createBudget({
          category: budgetModalCategory.trim(),
          amount,
          frequency: budgetDraftFrequency,
          rollover: budgetDraftRollover,
          rollover_start_month: rolloverStart,
        });
      }
      await loadBudgets();
      setIsBudgetModalOpen(false);
    } catch (err) {
      console.error('Failed to save budget', err);
      setBudgetError('Failed to save budget. Please try again.');
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    setBudgetSaving(true);
    setBudgetError(null);
    try {
      await BudgetService.deleteBudget(id);
      await loadBudgets();
      if (budgetModalCategory) {
        setIsBudgetModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete budget', err);
      setBudgetError('Failed to delete budget. Please try again.');
    } finally {
      setBudgetSaving(false);
    }
  };

  const modalPreview = useMemo(() => {
    if (!budgetModalCategory) return null;
    const amount = Number(budgetDraftAmount) || 0;
    const targetCat = budgetModalCategory.trim().toLowerCase();
    const existing = budgets.find((b) => b.category.trim().toLowerCase() === targetCat);
    const currentPeriodStr =
      period.month === null
        ? `${period.year}-01`
        : `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
    const rolloverStart = budgetDraftRollover
      ? existing?.rollover_start_month || currentPeriodStr
      : undefined;

    const tempBudget: Budget = {
      id: 'preview',
      category: budgetModalCategory,
      amount,
      frequency: budgetDraftFrequency,
      rollover: budgetDraftRollover,
      rollover_start_month: rolloverStart,
    };

    const parentMajor = getMajorCategoryForSubcategory(budgetModalCategory, userCategories);
    const isSub = Boolean(parentMajor && parentMajor.toLowerCase() !== targetCat);

    return BudgetCalculator.computeRolloverBudget(
      tempBudget,
      effectiveYtdTransactions,
      period,
      isSub ? budgetModalCategory : null
    );
  }, [
    budgetModalCategory,
    budgetDraftAmount,
    budgetDraftFrequency,
    budgetDraftRollover,
    budgets,
    userCategories,
    effectiveYtdTransactions,
    period,
  ]);

  // Pills overflow handled within HeroStatCard

  const stats = useMemo(() => {
    const totalCount = transactions.length;
    const totalShown = transactions.reduce((sum, t) => sum + getDisplayAmount(t), 0);
    const totalVolume = transactions.reduce((sum, t) => sum + Math.abs(getDisplayAmount(t)), 0);
    const spendingTransactions = transactions.filter(isSpendingTransaction);
    const totalSpent = transactions.reduce((sum, t) => sum + getNetSpendingAmount(t), 0);

    const avgTransaction = totalCount > 0 ? totalVolume / totalCount : 0;

    const largestTransaction =
      transactions.length > 0
        ? transactions.reduce(
            (max, t) => (Math.abs(getDisplayAmount(t)) > Math.abs(getDisplayAmount(max)) ? t : max),
            transactions[0]
          )
        : null;

    const categoryCounts = new Map<string, number>();
    transactions.forEach((t) => {
      const cat = formatCategoryName(t.category?.primary || 'Shopping');
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, _]) => name);

    const warningSymbol = '\u26A0';

    const categoryDriver =
      topCategories.length > 0
        ? topCategories.length === 1
          ? `${warningSymbol} ${topCategories[0]}`
          : `${warningSymbol} ${topCategories[0]} & ${topCategories[1]}`
        : null;

    const pendingTransactions = transactions.filter((t) => Boolean(t.pending));
    const pendingCount = pendingTransactions.length;

    return {
      totalCount,
      totalShown,
      totalSpent,
      spendingCount: spendingTransactions.length,
      pendingCount,
      avgTransaction,
      largestTransaction,
      categoryDriver,
    };
  }, [transactions]);

  // No local scroll fade management needed

  return (
    <div data-testid="transactions-page">
      <PageLayout
        badge="Transaction History"
        title="Review every dollar across accounts"
        subtitle="Search and filter transactions across all connected accounts."
        error={error}
        stats={
          <div className={cn('grid', 'gap-3', 'sm:grid-cols-2', 'lg:grid-cols-5')}>
            <HeroStatCard
              index={1}
              title="Transactions"
              icon={<ReceiptText className={cn('h-4', 'w-4')} />}
              value={stats.totalCount}
              suffix={stats.totalCount === 1 ? 'item' : 'items'}
              subtext={`Net flow ${format(stats.totalShown)}`}
              pills={
                stats.pendingCount > 0
                  ? [
                      {
                        label: `${stats.pendingCount} pending`,
                        type: 'semantic' as const,
                        tone: 'warning' as const,
                      },
                    ]
                  : undefined
              }
            />

            <HeroStatCard
              index={2}
              title="Total spent"
              icon={<ShoppingBag className={cn('h-4', 'w-4')} />}
              value={format(stats.totalSpent)}
              subtext={`${stats.spendingCount} ${
                stats.spendingCount === 1 ? 'spend item' : 'spend items'
              }`}
              accent="rose"
              infoTooltip="Pending transactions are included in this total, along with settled transactions."
            />

            <HeroStatCard
              index={3}
              title="Average size"
              icon={<TrendingUp className={cn('h-4', 'w-4')} />}
              value={format(stats.avgTransaction)}
              subtext={stats.categoryDriver || undefined}
            />

            <HeroStatCard
              index={4}
              title="Largest size"
              icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
              value={
                stats.largestTransaction
                  ? format(Math.abs(getDisplayAmount(stats.largestTransaction)))
                  : format(0)
              }
              pills={
                stats.largestTransaction && stats.totalCount > 1
                  ? [
                      {
                        label:
                          (stats.largestTransaction.merchant || stats.largestTransaction.name) ??
                          '',
                      },
                    ]
                  : []
              }
            />

            <HeroStatCard
              index={5}
              title={budgetCardData.title}
              icon={<Target className={cn('h-4', 'w-4')} />}
              value={budgetCardData.value}
              suffix={budgetCardData.suffix}
              subtext={budgetCardData.subtext}
              pills={budgetCardData.pills}
              accent={budgetCardData.accent}
              onClick={() => handleOpenBudgetModal()}
            />
          </div>
        }
      >
        <div
          className={cn(
            'relative',
            'overflow-hidden',
            'rounded-[2.25rem]',
            'border',
            'border-white/35',
            'bg-white/18',
            'p-0',
            'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]',
            'backdrop-blur-2xl',
            'backdrop-saturate-[150%]',
            'transition-colors',
            'duration-500',
            'dark:border-white/12',
            'dark:bg-[#0f172a]/55',
            'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]'
          )}
        >
          <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
            <div
              className={cn(
                'absolute',
                'inset-[1px]',
                'rounded-[2.2rem]',
                'ring-1',
                'ring-white/40',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
                'dark:ring-white/10',
                'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]'
              )}
            />
            <div
              className={cn(
                'absolute',
                'inset-0',
                'bg-gradient-to-b',
                'from-white/65',
                'via-white/25',
                'to-transparent',
                'transition-colors',
                'duration-500',
                'dark:from-slate-900/68',
                'dark:via-slate-900/34',
                'dark:to-transparent'
              )}
            />
          </div>
          <div className={cn('relative', 'z-10')}>
            <div
              className={cn(
                'border-b',
                'border-slate-200/70',
                'px-6',
                'pb-4',
                'pt-6',
                'space-y-3',
                'dark:border-slate-700/50'
              )}
            >
              <div className={cn('flex', 'items-center', 'gap-4')}>
                <div className={cn('flex-1', 'min-w-0')}>
                  <TransactionsFilters
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    showSearch={false}
                    showCategories
                    showSubcategories={false}
                  />
                </div>
                <div className={cn('flex', 'flex-shrink-0', 'items-center', 'gap-2')}>
                  <TransactionsFilters
                    search={search}
                    onSearch={setSearch}
                    showSearch
                    showCategories={false}
                    showSubcategories={false}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRulesModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-violet-600 dark:text-slate-300 dark:hover:text-violet-400"
                    title="Manage auto-categorization rules"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-violet-500" />
                    <span>Rules</span>
                  </Button>
                </div>
              </div>

              {/* Sub-categories row underneath */}
              <div className={cn('flex', 'items-center', 'gap-4')}>
                <div className={cn('flex-1', 'min-w-0')}>
                  <TransactionsFilters
                    subcategories={subcategories}
                    selectedSubcategory={selectedSubcategory}
                    onSelectSubcategory={setSelectedSubcategory}
                    showSearch={false}
                    showCategories={false}
                    showSubcategories
                  />
                </div>
              </div>

              {/* Account filter */}
              <div className={cn('flex', 'items-center', 'gap-3')}>
                <span
                  className={cn(
                    'flex-shrink-0',
                    'text-[0.65rem]',
                    'font-semibold',
                    'uppercase',
                    'tracking-[0.24em]',
                    'text-slate-500',
                    'transition-colors',
                    'duration-500',
                    'dark:text-slate-400',
                    'w-28'
                  )}
                >
                  Account
                </span>
                <div className={cn('min-w-0', 'flex-1')}>
                  <div
                    className={cn(
                      'scrollbar-hide',
                      'flex',
                      'items-center',
                      'gap-2',
                      'overflow-x-auto',
                      'pb-1',
                      'pl-1',
                      'pt-1'
                    )}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(null)}
                      className={cn(
                        'inline-flex',
                        'flex-shrink-0',
                        'items-center',
                        'gap-1.5',
                        'whitespace-nowrap',
                        'rounded-full',
                        'px-2',
                        'py-0.5',
                        'text-xs',
                        'font-semibold',
                        'transition-all',
                        'duration-150',
                        'backdrop-blur-sm',
                        'ring-1',
                        'ring-white/60',
                        'dark:ring-white/10',
                        selectedAccountId === null
                          ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/40'
                          : 'bg-white/65 text-slate-600 hover:-translate-y-[2px] hover:shadow-lg dark:bg-white/10 dark:text-slate-300'
                      )}
                      aria-pressed={selectedAccountId === null}
                      title="Show transactions from all accounts"
                    >
                      All accounts
                    </button>
                    {accountOptions.map((account) => {
                      const isSelected = selectedAccountId === account.id;
                      const label = formatAccountOptionLabel(account);
                      const title = formatAccountOptionTitle(account);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                          className={cn(
                            'inline-flex',
                            'flex-shrink-0',
                            'items-center',
                            'gap-1.5',
                            'whitespace-nowrap',
                            'rounded-full',
                            'px-2',
                            'py-0.5',
                            'text-xs',
                            'font-semibold',
                            'transition-all',
                            'duration-150',
                            'backdrop-blur-sm',
                            'ring-1',
                            'ring-white/60',
                            'dark:ring-white/10',
                            isSelected
                              ? 'bg-cyan-100 text-cyan-700 ring-2 ring-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/40'
                              : 'bg-white/65 text-slate-600 hover:-translate-y-[2px] hover:shadow-lg dark:bg-white/10 dark:text-slate-300'
                          )}
                          aria-pressed={isSelected}
                          title={
                            isSelected ? `Remove account filter: ${title}` : `Filter by ${title}`
                          }
                        >
                          <span
                            className={cn(
                              'h-2',
                              'w-2',
                              'rounded-full',
                              isSelected ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-500'
                            )}
                            aria-hidden="true"
                          />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {isLoading ? (
              <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
                <div className="text-center">
                  <div
                    className={cn(
                      'text-lg',
                      'font-medium',
                      'text-slate-600',
                      'dark:text-slate-400',
                      'mb-2'
                    )}
                  >
                    Loading transactions...
                  </div>
                  <div className={cn('text-sm', 'text-slate-500', 'dark:text-slate-500')}>
                    Fetching data from server
                  </div>
                </div>
              </div>
            ) : (
              <TransactionsTable
                items={pageItems}
                total={totalItems}
                currentPage={currentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
                onNext={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                duplicateCandidateIds={duplicateCandidateIds}
                onMarkDuplicate={markTransactionDuplicate}
                userCategories={userCategories}
                onCategorySelect={updateTransactionCategory}
                onCategoryReset={resetTransactionCategory}
                onCategoryCreate={createCategoryAndAssign}
                onCategoryRule={handleCreateCategoryRule}
                onCategoryDelete={deleteUserCategory}
                onOpenRulesModal={() => setIsRulesModalOpen(true)}
              />
            )}
          </div>
        </div>
        <MonthYearSelector value={selectedPeriod} onChange={setPeriod} />
      </PageLayout>

      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        size={selectedCategory || selectedSubcategory ? 'md' : 'lg'}
      >
        <GlassCard className="relative p-6" variant="default" rounded="xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-700/60">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedSubcategory || selectedCategory
                  ? matchedBudget
                    ? `Edit Budget: ${formatCategoryName(selectedSubcategory || selectedCategory)}${
                        selectedSubcategory &&
                        selectedCategory &&
                        selectedSubcategory !== selectedCategory
                          ? ` (${formatCategoryName(selectedCategory)})`
                          : ''
                      }`
                    : `Set Budget: ${formatCategoryName(selectedSubcategory || selectedCategory)}${
                        selectedSubcategory &&
                        selectedCategory &&
                        selectedSubcategory !== selectedCategory
                          ? ` (${formatCategoryName(selectedCategory)})`
                          : ''
                      }`
                  : 'Manage Budgets'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedSubcategory || selectedCategory
                  ? period.month === null
                    ? `Spend: ${format(categorySpent)} in ${period.year}`
                    : `Spend: ${format(categorySpent)} this month • ${format(categoryYtdSpent)} Year-To-Date (${period.year})`
                  : 'Configure monthly spending targets, frequencies, and rollover tracking across categories'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBudgetModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {budgetError && (
            <div className="mt-4">
              <Alert variant="error">{budgetError}</Alert>
            </div>
          )}

          {selectedCategory || selectedSubcategory ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FormLabel
                    htmlFor="budget-amount"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block"
                  >
                    Monthly Target ($)
                  </FormLabel>
                  <Input
                    id="budget-amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 100"
                    value={budgetDraftAmount}
                    onChange={(e) => setBudgetDraftAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <FormLabel
                    htmlFor="budget-frequency"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block"
                  >
                    Frequency
                  </FormLabel>
                  <select
                    id="budget-frequency"
                    value={budgetDraftFrequency}
                    onChange={(e) => setBudgetDraftFrequency(e.target.value as BudgetFrequency)}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-[#111a2f] dark:text-white"
                  >
                    <option value="monthly">Monthly (every month)</option>
                    <option value="quarterly">Quarterly (every 3 months, e.g. Water)</option>
                    <option value="semi_annual">
                      Semi-Annually (twice a year, e.g. Car Insurance)
                    </option>
                    <option value="annual">Annually (once a year)</option>
                  </select>
                </div>
              </div>

              {/* Rollover Toggle */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-slate-700/60 dark:bg-slate-800/40 p-3 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors rounded-lg">
                  <input
                    type="checkbox"
                    checked={budgetDraftRollover}
                    onChange={(e) => setBudgetDraftRollover(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Rollover Budget
                    </div>
                    <div className="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5">
                      Accumulate unspent monthly budget and carry it forward into future months
                      (ideal for quarterly bills or semi-annual insurance payments).
                    </div>
                  </div>
                </label>
              </div>

              {/* Live Preview Box */}
              {modalPreview && Number(budgetDraftAmount) > 0 && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 dark:border-sky-900/40 dark:bg-sky-950/20 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                      Budget Summary & Tracking
                    </span>
                    {budgetDraftFrequency !== 'monthly' && (
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 font-medium">
                        {format(modalPreview.periodAmount)} every {modalPreview.periodMultiplier}{' '}
                        months
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600 dark:text-slate-300 text-[0.72rem]">
                    <div>
                      <span className="text-slate-400 dark:text-slate-400 block text-[0.65rem] uppercase tracking-wider font-semibold">
                        Monthly Target
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {format(modalPreview.monthlyAmount)} / mo
                      </span>
                    </div>
                    {budgetDraftRollover && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-400 block text-[0.65rem] uppercase tracking-wider font-semibold">
                          Rollover Pool
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          +{format(modalPreview.priorCarryover)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 dark:text-slate-400 block text-[0.65rem] uppercase tracking-wider font-semibold">
                        Spent This Month
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {format(modalPreview.monthSpent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-400 block text-[0.65rem] uppercase tracking-wider font-semibold">
                        {budgetDraftRollover ? 'Available This Month' : 'Remaining'}
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          modalPreview.isOverBudget
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {format(
                          budgetDraftRollover
                            ? modalPreview.availableThisMonth
                            : modalPreview.remainingThisMonth
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-sky-100 dark:border-sky-900/30 pt-2 flex items-center justify-between text-[0.72rem]">
                    <span className="text-slate-500 dark:text-slate-400">
                      {resolveMajorCategory(budgetModalCategory).toLowerCase() === 'insurance'
                        ? 'Year-To-Date spent on all insurances:'
                        : `Year-To-Date spent in ${period.year}:`}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {format(modalPreview.ytdSpent)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 gap-2">
                {matchedBudget ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteBudget(matchedBudget.id)}
                    disabled={budgetSaving}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBudgetModalOpen(false)}
                    disabled={budgetSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSaveBudget}
                    disabled={budgetSaving}
                  >
                    {budgetSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-800/40 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {budgetModalCategory
                    ? `Set Budget for ${formatCategoryName(budgetModalCategory)}`
                    : 'Add or Edit Budget'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FormLabel className="text-[0.7rem] text-slate-500 mb-1 block">
                      Category / Subcategory
                    </FormLabel>
                    <select
                      value={budgetModalCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBudgetModalCategory(val);
                        const existing = budgets.find(
                          (b) => b.category.trim().toLowerCase() === val.trim().toLowerCase()
                        );
                        if (existing) {
                          setBudgetDraftAmount(String(existing.amount));
                          setBudgetDraftFrequency(existing.frequency || 'monthly');
                          setBudgetDraftRollover(Boolean(existing.rollover));
                        } else {
                          setBudgetDraftAmount('');
                          setBudgetDraftFrequency('monthly');
                          setBudgetDraftRollover(false);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-[#111a2f] dark:text-white"
                    >
                      <option value="">Select category...</option>
                      {CATEGORIES_TAXONOMY.filter((c) => c.type !== 'Exclude from Budget').map(
                        (c) => (
                          <optgroup key={c.name} label={c.name}>
                            <option value={c.name}>{c.name} (All)</option>
                            {c.subcategories.map((sub) => (
                              <option key={`${c.name}-${sub}`} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <FormLabel className="text-[0.7rem] text-slate-500 mb-1 block">
                      Monthly Target ($)
                    </FormLabel>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 100"
                      value={budgetDraftAmount}
                      onChange={(e) => setBudgetDraftAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel className="text-[0.7rem] text-slate-500 mb-1 block">
                      Frequency
                    </FormLabel>
                    <select
                      value={budgetDraftFrequency}
                      onChange={(e) => setBudgetDraftFrequency(e.target.value as BudgetFrequency)}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-[#111a2f] dark:text-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly (3 mo, e.g. Water)</option>
                      <option value="semi_annual">Semi-Annually (twice/yr)</option>
                      <option value="annual">Annually (1 yr)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={budgetDraftRollover}
                        onChange={(e) => setBudgetDraftRollover(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                      />
                      <span>Rollover unspent balance each month</span>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSaveBudget}
                    disabled={budgetSaving || !budgetModalCategory || !budgetDraftAmount}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Save Budget
                  </Button>
                </div>

                {/* Live Preview in Manage View */}
                {modalPreview && Number(budgetDraftAmount) > 0 && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-900/40 dark:bg-sky-950/20 text-xs space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">
                        Preview: {formatCategoryName(budgetModalCategory)}
                      </span>
                      {budgetDraftFrequency !== 'monthly' && (
                        <span className="text-[0.68rem] text-sky-700 dark:text-sky-300">
                          {format(modalPreview.periodAmount)} every {modalPreview.periodMultiplier}{' '}
                          mo
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.72rem] text-slate-600 dark:text-slate-300">
                      <div>
                        Target:{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {format(modalPreview.monthlyAmount)}/mo
                        </span>
                      </div>
                      {budgetDraftRollover && (
                        <div>
                          Carryover:{' '}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{format(modalPreview.priorCarryover)}
                          </span>
                        </div>
                      )}
                      <div>
                        Spent this mo:{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {format(modalPreview.monthSpent)}
                        </span>
                      </div>
                      <div>
                        {resolveMajorCategory(budgetModalCategory).toLowerCase() === 'insurance'
                          ? 'All Insurances YTD: '
                          : 'YTD: '}
                        <span className="font-bold text-slate-900 dark:text-white">
                          {format(modalPreview.ytdSpent)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Active Budgets ({budgets.length})
                </div>
                {budgets.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                    No budgets configured yet. Select a category above to set one.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {budgets.map((b) => {
                      const rolloverData = BudgetCalculator.computeRolloverBudget(
                        b,
                        effectiveYtdTransactions,
                        period
                      );
                      const isOver = rolloverData.isOverBudget;
                      const percent = rolloverData.percentageUsed;
                      const freq = b.frequency || 'monthly';
                      const freqBadge =
                        freq === 'semi_annual'
                          ? 'Twice / yr'
                          : freq === 'quarterly'
                            ? 'Every 3 mos'
                            : freq === 'annual'
                              ? 'Yearly'
                              : null;

                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200/60 bg-white/50 dark:border-slate-700/50 dark:bg-slate-800/30"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                {formatCategoryName(b.category)}
                              </span>
                              {(() => {
                                const parent = resolveMajorCategory(b.category);
                                return parent.toLowerCase() !== b.category.toLowerCase() ? (
                                  <span className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                    in {parent}
                                  </span>
                                ) : null;
                              })()}
                              {freqBadge && (
                                <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 uppercase tracking-wider">
                                  {freqBadge}
                                </span>
                              )}
                              {b.rollover && (
                                <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 uppercase tracking-wider">
                                  Rollover
                                </span>
                              )}
                              <span
                                className={cn(
                                  'text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                  isOver
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                )}
                              >
                                {percent}%
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                              <span>
                                {b.rollover
                                  ? `${format(rolloverData.monthSpent)} of ${format(rolloverData.availableThisMonth)} available`
                                  : `${format(rolloverData.monthSpent)} of ${format(b.amount)}`}
                              </span>
                              {b.rollover && rolloverData.priorCarryover > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  (+{format(rolloverData.priorCarryover)} roll)
                                </span>
                              )}
                              <span>•</span>
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                {format(rolloverData.ytdSpent)} YTD
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetModalCategory(b.category);
                                setBudgetDraftAmount(String(b.amount));
                                setBudgetDraftFrequency(b.frequency || 'monthly');
                                setBudgetDraftRollover(Boolean(b.rollover));
                              }}
                              title="Edit budget"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBudget(b.id)}
                              title="Delete budget"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </Modal>

      <CategoryRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        userCategories={userCategories}
        onRulesChanged={() => reloadTransactions(true)}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-violet-200 bg-white/95 px-4 py-3 text-xs font-medium text-slate-800 shadow-xl backdrop-blur-md dark:border-violet-800 dark:bg-slate-900/95 dark:text-slate-100">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
            ✓
          </span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
