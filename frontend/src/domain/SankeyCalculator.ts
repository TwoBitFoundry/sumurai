import type { Transaction } from '../types/api';
import {
  formatCategoryName,
  isSpendingExcludedCategory,
  resolveMajorCategory,
} from '../utils/categories';
import {
  getDisplayAmount,
  getNetSpendingAmount,
  isSpendingTransaction,
} from '../utils/transactionAmounts';

export interface SankeyNodeData {
  id: string;
  name: string;
  formattedName: string;
  amount: number;
  color: string;
  categoryType: 'inflow' | 'outflow' | 'hub' | 'savings' | 'deficit' | 'subcategory';
  percentage?: number;
}

export interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  color?: string;
}

export interface SankeyStats {
  totalInflow: number;
  totalOutflow: number;
  netSavings: number;
  savingsRate: number;
  topExpenseCategory: { name: string; amount: number; percentage: number } | null;
  inflowCount: number;
  outflowCount: number;
}

export interface SankeyCalculationResult {
  nodes: SankeyNodeData[];
  links: SankeyLinkData[];
  stats: SankeyStats;
  hasData: boolean;
  hasIncome: boolean;
}

export interface SankeyOptions {
  includeSubcategories?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  // Inflow & Balances
  'earned income': '#10b981',
  income: '#10b981',
  paycheck: '#059669',
  salary: '#059669',
  bonus: '#34d399',
  'net savings': '#10b981',
  'from savings': '#f59e0b',
  'total income': '#0d9488',
  'total spending': '#64748b',

  // Outflow Major Categories
  'bills & utilities': '#0284c7',
  'food & dining': '#f43f5e',
  groceries: '#84cc16',
  'home management': '#6366f1',
  'home improvement': '#06b6d4',
  shopping: '#8b5cf6',
  transportation: '#f97316',
  medical: '#ec4899',
  education: '#14b8a6',
  entertainment: '#3b82f6',
  childcare: '#d946ef',
  insurance: '#0284c7',
  pets: '#eab308',
  'gifts & donations': '#e11d48',
  travel: '#0ea5e9',
  other: '#64748b',
  uncategorized: '#94a3b8',
};

const PALETTE = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#6366f1',
  '#84cc16',
  '#ec4899',
  '#d946ef',
  '#3b82f6',
];

export function getCategoryColor(categoryName: string, index = 0): string {
  const norm = categoryName.trim().toLowerCase();
  if (CATEGORY_COLORS[norm]) return CATEGORY_COLORS[norm];
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (norm.includes(key)) return color;
  }
  return PALETTE[index % PALETTE.length];
}

export function groupMinorSubcategories(
  subs: Array<[string, number]>,
  categoryTotal: number,
  thresholdAmount = 30,
  thresholdPct = 0.05
): Array<[string, number]> {
  // If 3 or fewer subcategories, keep them as is
  if (subs.length <= 3) {
    return subs;
  }

  const primary: Array<[string, number]> = [];
  let otherTotal = 0;
  let minorCount = 0;

  for (const [name, amount] of subs) {
    const isMinor =
      amount < thresholdAmount &&
      (categoryTotal > 0 ? amount / categoryTotal < thresholdPct : true);
    if (isMinor) {
      otherTotal += amount;
      minorCount++;
    } else {
      primary.push([name, amount]);
    }
  }

  // Club into 'Other' if at least 2 minor items were identified
  if (minorCount >= 2 && otherTotal > 0) {
    primary.push(['Other', Math.round(otherTotal * 100) / 100]);
    return primary.sort((a, b) => b[1] - a[1]);
  }

  return subs;
}

export class SankeyCalculator {
  static computeSankeyData(
    transactions: Transaction[],
    options: SankeyOptions = { includeSubcategories: true }
  ): SankeyCalculationResult {
    const includeSub = options.includeSubcategories ?? true;

    // Accumulators
    const inflowBySource = new Map<string, number>();
    const outflowByCategory = new Map<
      string,
      { total: number; subcategories: Map<string, number> }
    >();
    let totalInflow = 0;
    let totalOutflow = 0;
    let inflowCount = 0;
    let outflowCount = 0;

    for (const t of transactions) {
      if (t.pending) continue;

      const rawCategory = t.custom_category ?? t.rule_category ?? t.category?.primary ?? '';
      const resolvedMajor = resolveMajorCategory(rawCategory);

      // Exclude inter-account transfers and credit card payments
      if (
        resolvedMajor.toLowerCase() === 'transfer' ||
        (t.category?.detailed &&
          (t.category.detailed.toLowerCase().includes('credit card payment') ||
            t.category.detailed.toLowerCase().includes('cash spending transfer')))
      ) {
        continue;
      }

      const displayAmount = getDisplayAmount(t);
      const isSpend = isSpendingTransaction(t);
      const netSpend = getNetSpendingAmount(t);

      // 1. Inflow: Earned Income or positive cash inflow on non-credit accounts
      const isIncomeCategory =
        resolvedMajor.toLowerCase() === 'earned income' ||
        resolvedMajor.toLowerCase() === 'tax refund' ||
        rawCategory.toLowerCase().includes('income') ||
        rawCategory.toLowerCase().includes('paycheck') ||
        rawCategory.toLowerCase().includes('salary') ||
        rawCategory.toLowerCase().includes('bonus');

      const isDepositoryInflow =
        (t.account_type?.toLowerCase() === 'depository' ||
          t.account_type?.toLowerCase() === 'checking' ||
          t.account_type?.toLowerCase() === 'savings') &&
        displayAmount > 0 &&
        !isSpend;

      if (isIncomeCategory || isDepositoryInflow) {
        const inflowAmt = Math.abs(displayAmount > 0 ? displayAmount : Number(t.amount));
        if (inflowAmt > 0) {
          const rawDetailed = t.custom_subcategory ?? t.rule_subcategory ?? t.category?.detailed;
          const sourceName = formatCategoryName(
            rawDetailed && rawDetailed.toLowerCase() !== 'other'
              ? rawDetailed
              : rawCategory || 'Paycheck'
          );

          inflowBySource.set(sourceName, (inflowBySource.get(sourceName) ?? 0) + inflowAmt);
          totalInflow += inflowAmt;
          inflowCount++;
          continue;
        }
      }

      // 2. Outflow: Standard spending transactions
      if (isSpend && netSpend > 0) {
        const catKey = resolvedMajor;
        const subRaw =
          t.custom_subcategory ?? t.rule_subcategory ?? t.category?.detailed ?? rawCategory;

        const isGeneric =
          !subRaw ||
          subRaw.trim().toLowerCase() === 'other' ||
          subRaw.trim().toLowerCase() === 'general' ||
          subRaw.trim().toLowerCase() === 'uncategorized' ||
          subRaw.trim().toLowerCase() === catKey.trim().toLowerCase() ||
          subRaw.trim().toLowerCase().startsWith('other ') ||
          subRaw.trim().toLowerCase().startsWith('general ');

        const subName = formatCategoryName(isGeneric ? catKey : subRaw);

        if (!outflowByCategory.has(catKey)) {
          outflowByCategory.set(catKey, { total: 0, subcategories: new Map() });
        }
        const catEntry = outflowByCategory.get(catKey)!;
        catEntry.total += netSpend;
        catEntry.subcategories.set(subName, (catEntry.subcategories.get(subName) ?? 0) + netSpend);

        totalOutflow += netSpend;
        outflowCount++;
      }
    }

    totalInflow = Math.round(totalInflow * 100) / 100;
    totalOutflow = Math.round(totalOutflow * 100) / 100;

    const netSavings = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const savingsRate =
      totalInflow > 0 ? Math.round(((totalInflow - totalOutflow) / totalInflow) * 1000) / 10 : 0;

    // Top Expense Category
    let topExpenseCategory: SankeyStats['topExpenseCategory'] = null;
    let maxExpense = 0;
    for (const [cat, data] of outflowByCategory.entries()) {
      if (data.total > maxExpense) {
        maxExpense = data.total;
        topExpenseCategory = {
          name: cat,
          amount: Math.round(data.total * 100) / 100,
          percentage: totalOutflow > 0 ? Math.round((data.total / totalOutflow) * 100) : 0,
        };
      }
    }

    const stats: SankeyStats = {
      totalInflow,
      totalOutflow,
      netSavings,
      savingsRate,
      topExpenseCategory,
      inflowCount,
      outflowCount,
    };

    const hasData = totalInflow > 0 || totalOutflow > 0;
    const hasIncome = totalInflow > 0;

    if (!hasData) {
      return { nodes: [], links: [], stats, hasData: false, hasIncome: false };
    }

    const nodes: SankeyNodeData[] = [];
    const links: SankeyLinkData[] = [];
    const nodeIndexMap = new Map<string, number>();

    const addNode = (
      id: string,
      name: string,
      amount: number,
      color: string,
      categoryType: SankeyNodeData['categoryType'],
      percentage?: number
    ): number => {
      if (nodeIndexMap.has(id)) {
        return nodeIndexMap.get(id)!;
      }
      const index = nodes.length;
      nodeIndexMap.set(id, index);
      nodes.push({
        id,
        name,
        formattedName: formatCategoryName(name),
        amount: Math.round(amount * 100) / 100,
        color,
        categoryType,
        percentage,
      });
      return index;
    };

    const addLink = (sourceIdx: number, targetIdx: number, value: number, color?: string) => {
      const roundedVal = Math.round(value * 100) / 100;
      if (roundedVal <= 0) return;
      const sourceNode = nodes[sourceIdx];
      const targetNode = nodes[targetIdx];
      links.push({
        source: sourceIdx,
        target: targetIdx,
        value: roundedVal,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        sourceName: sourceNode.name,
        targetName: targetNode.name,
        color: color || sourceNode.color,
      });
    };

    // Sort categories descending by amount
    const sortedCategories = Array.from(outflowByCategory.entries()).sort(
      (a, b) => b[1].total - a[1].total
    );

    // ==========================================
    // CASE 1: Full Cash Flow (Income > 0)
    // ==========================================
    if (hasIncome) {
      const hubId = 'hub_total_income';
      const hubIdx = addNode(
        hubId,
        'Total Income',
        Math.max(totalInflow, totalOutflow),
        '#0d9488',
        'hub'
      );

      // Layer 0: Income Sources -> Total Income Hub
      for (const [srcName, amount] of inflowBySource.entries()) {
        const srcId = `inflow_${srcName}`;
        const pct = totalInflow > 0 ? Math.round((amount / totalInflow) * 100) : 0;
        const srcIdx = addNode(srcId, srcName, amount, getCategoryColor(srcName), 'inflow', pct);
        addLink(srcIdx, hubIdx, amount, nodes[srcIdx].color);
      }

      // If deficit (spending > income), add a deficit balancing node into Total Hub
      if (netSavings < 0) {
        const deficitAmt = Math.abs(netSavings);
        const defId = 'inflow_from_savings';
        const defIdx = addNode(defId, 'From Savings', deficitAmt, '#f59e0b', 'deficit');
        addLink(defIdx, hubIdx, deficitAmt, '#f59e0b');
      }

      // Layer 2: Total Income Hub -> Major Categories & Net Savings
      for (const [catName, catData] of sortedCategories) {
        const catId = `cat_${catName}`;
        const pct = totalOutflow > 0 ? Math.round((catData.total / totalOutflow) * 100) : 0;
        const catIdx = addNode(
          catId,
          catName,
          catData.total,
          getCategoryColor(catName),
          'outflow',
          pct
        );
        addLink(hubIdx, catIdx, catData.total, nodes[catIdx].color);

        // Layer 3: Major Category -> Subcategories (if enabled)
        if (includeSub && catData.subcategories.size > 0) {
          const rawSubs = Array.from(catData.subcategories.entries()).sort((a, b) => b[1] - a[1]);
          const sortedSubs = groupMinorSubcategories(rawSubs, catData.total);

          for (const [subName, subAmt] of sortedSubs) {
            const subId = `sub_${catName}_${subName}`;
            const subPct = catData.total > 0 ? Math.round((subAmt / catData.total) * 100) : 0;
            const subIdx = addNode(
              subId,
              subName,
              subAmt,
              nodes[catIdx].color,
              'subcategory',
              subPct
            );
            addLink(catIdx, subIdx, subAmt, nodes[catIdx].color);
          }
        }
      }

      // If surplus, link Total Income Hub -> Net Savings
      if (netSavings > 0) {
        const savId = 'savings_net';
        const savIdx = addNode(savId, 'Net Savings', netSavings, '#10b981', 'savings', savingsRate);
        addLink(hubIdx, savIdx, netSavings, '#10b981');
      }
    } else {
      // ==========================================
      // CASE 2: Spending-Only Flow (No Income recorded)
      // ==========================================
      const hubId = 'hub_total_spending';
      const hubIdx = addNode(hubId, 'Total Spending', totalOutflow, '#64748b', 'hub');

      for (const [catName, catData] of sortedCategories) {
        const catId = `cat_${catName}`;
        const pct = totalOutflow > 0 ? Math.round((catData.total / totalOutflow) * 100) : 0;
        const catIdx = addNode(
          catId,
          catName,
          catData.total,
          getCategoryColor(catName),
          'outflow',
          pct
        );
        addLink(hubIdx, catIdx, catData.total, nodes[catIdx].color);

        if (includeSub && catData.subcategories.size > 0) {
          const rawSubs = Array.from(catData.subcategories.entries()).sort((a, b) => b[1] - a[1]);
          const sortedSubs = groupMinorSubcategories(rawSubs, catData.total);

          for (const [subName, subAmt] of sortedSubs) {
            const subId = `sub_${catName}_${subName}`;
            const subPct = catData.total > 0 ? Math.round((subAmt / catData.total) * 100) : 0;
            const subIdx = addNode(
              subId,
              subName,
              subAmt,
              nodes[catIdx].color,
              'subcategory',
              subPct
            );
            addLink(catIdx, subIdx, subAmt, nodes[catIdx].color);
          }
        }
      }
    }

    return {
      nodes,
      links,
      stats,
      hasData: true,
      hasIncome,
    };
  }
}
