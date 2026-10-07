export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Shopping';
  const norm = categoryPrimary.trim().toLowerCase();
  if (
    norm === 'other' ||
    norm === 'uncategorized' ||
    norm === 'unknown' ||
    norm === 'general merchandise' ||
    norm === 'general_merchandise' ||
    norm === 'general'
  ) {
    return 'Shopping';
  }
  const formatted = categoryPrimary
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  if (formatted.toLowerCase() === 'general merchandise' || formatted.toLowerCase() === 'other') {
    return 'Shopping';
  }
  return formatted;
}

export type CategoryGroupType = 'Expense' | 'Income' | 'Exclude from Budget';

export interface CategoryDefinition {
  name: string;
  type: CategoryGroupType;
  subcategories: string[];
}

export const CATEGORIES_TAXONOMY: CategoryDefinition[] = [
  {
    name: 'Bills & Utilities',
    type: 'Expense',
    subcategories: ['AI', 'Internet', 'Phone', 'Television', 'Utilities', 'Water'],
  },
  {
    name: 'Childcare',
    type: 'Expense',
    subcategories: [
      'Baby Supplies',
      'Babysitter & Daycare',
      'Child Support',
      'Kids Activities',
      'Toys',
    ],
  },
  {
    name: 'Earned Income',
    type: 'Income',
    subcategories: ['Bonus', 'Paycheck'],
  },
  {
    name: 'Education',
    type: 'Expense',
    subcategories: ['Books & Supplies', 'Tuition'],
  },
  {
    name: 'Entertainment',
    type: 'Expense',
    subcategories: [
      'Amusement',
      'Arts',
      'Movies & DVDs',
      'Music',
      'Newspaper & Magazines',
      'Subscription',
    ],
  },
  {
    name: 'Food & Dining',
    type: 'Expense',
    subcategories: ['Alcohol & Bars', 'Coffee Shops', 'Fast Food', 'Restaurants'],
  },
  {
    name: 'Gifts & Donations',
    type: 'Expense',
    subcategories: ['Charity', 'Children Allowance', 'Gifts'],
  },
  {
    name: 'Groceries',
    type: 'Expense',
    subcategories: ['Groceries'],
  },
  {
    name: 'Home Improvement',
    type: 'Expense',
    subcategories: ['Furnishings', 'Household Supplies', 'Lawn & Garden', 'Plants & Needs'],
  },
  {
    name: 'Home Management',
    type: 'Expense',
    subcategories: ['Home Insurance', 'Home Services', 'Mortgage'],
  },
  {
    name: 'Insurance',
    type: 'Expense',
    subcategories: ['Auto Insurance', 'Car Insurance', 'Health Insurance', 'Life Insurance'],
  },
  {
    name: 'Medical',
    type: 'Expense',
    subcategories: ['Dentist', 'Doctor', 'Eyecare', 'Labs', 'Mental Health', 'Pharmacy'],
  },
  {
    name: 'Pets',
    type: 'Expense',
    subcategories: ['Boarding', 'Insurance'],
  },
  {
    name: 'Shopping',
    type: 'Expense',
    subcategories: [
      'Books',
      'Clothing',
      'Decor',
      'Electronics',
      'Hair',
      'Hobbies',
      'Home',
      'Kitchen',
      'Laundry',
      'Personal Care',
      'Spa & Massage',
      'Toys',
    ],
  },
  {
    name: 'Taxes',
    type: 'Expense',
    subcategories: [
      'Federal Tax',
      'Local Tax',
      'Property Tax',
      'Sales Tax',
      'State Tax',
      'Tax Filing',
    ],
  },
  {
    name: 'Tax Refund',
    type: 'Income',
    subcategories: ['Federal Tax', 'Local Tax', 'Property Tax', 'Sales Tax', 'State Tax'],
  },
  {
    name: 'Transportation',
    type: 'Expense',
    subcategories: [
      'Auto Payment',
      'Car Insurance',
      'Car Maintainance',
      'Car Registration',
      'Gas',
      'Parking',
      'Public Transport',
      'Toll',
      'Traffic Ticket',
    ],
  },
  {
    name: 'Transfer',
    type: 'Exclude from Budget',
    subcategories: [
      'Cash Spending Transfer',
      'Credit Card Payment',
      'Crypto Deposit',
      'Crypto Withdrawal',
      'Investment Deposit',
      'Investment Withdrawal',
      'Mortgage Payment',
    ],
  },
  {
    name: 'Travel',
    type: 'Expense',
    subcategories: ['Air Travel', 'Hotel', 'Rental Car & Transportation'],
  },
];

export function getAllMajorCategories(): string[] {
  return CATEGORIES_TAXONOMY.map((cat) => cat.name);
}

export function getSubcategoriesForCategory(
  categoryName: string,
  userCategories?: Array<{ name: string; parent_category?: string }>
): string[] {
  const norm = categoryName.trim().toLowerCase();
  const found = CATEGORIES_TAXONOMY.find((cat) => cat.name.toLowerCase() === norm);
  let baseSubcategories = found ? [...found.subcategories] : [];

  if (userCategories) {
    for (const uc of userCategories) {
      if (uc.parent_category && uc.parent_category.toLowerCase() === norm) {
        if (!baseSubcategories.includes(uc.name)) {
          baseSubcategories.push(uc.name);
        }
      }
    }
  }

  // Filter out any "Other xx" or "Uncategorized" or "Other" or "General Merchandise" subcategories, or subcategories matching the category itself
  baseSubcategories = baseSubcategories.filter(
    (sub) =>
      !sub.toLowerCase().startsWith('other ') &&
      sub.toLowerCase() !== 'other' &&
      sub.toLowerCase() !== 'uncategorized' &&
      sub.toLowerCase() !== 'general merchandise' &&
      sub.toLowerCase() !== 'general_merchandise' &&
      (norm === 'groceries' ? true : sub.trim().toLowerCase() !== norm)
  );

  return baseSubcategories;
}

export function getMajorCategoryForSubcategory(
  subcategoryName: string,
  userCategories?: Array<{ name: string; parent_category?: string }>
): string | undefined {
  const norm = subcategoryName.trim().toLowerCase();

  if (
    norm === 'general merchandise' ||
    norm === 'general_merchandise' ||
    norm === 'other' ||
    norm === 'uncategorized' ||
    norm === 'general'
  ) {
    return 'Shopping';
  }

  // Check user custom categories first
  if (userCategories) {
    const uc = userCategories.find((c) => c.name.toLowerCase() === norm);
    if (uc?.parent_category) {
      return uc.parent_category;
    }
  }

  // Check built-in taxonomy
  for (const cat of CATEGORIES_TAXONOMY) {
    if (cat.subcategories.some((sub) => sub.toLowerCase() === norm)) {
      return cat.name;
    }
  }

  // If subcategory is like "Other Shopping", map to "Shopping"
  if (norm.startsWith('other ')) {
    const candidate = norm.slice(6).trim();
    const matched = CATEGORIES_TAXONOMY.find((c) => c.name.toLowerCase() === candidate);
    if (matched) return matched.name;
    return 'Shopping';
  }

  if (
    norm === 'water' ||
    norm.includes('water') ||
    norm.includes('rent_and_utilities') ||
    norm.includes('rent & utilities')
  ) {
    return 'Bills & Utilities';
  }

  if (norm === 'home supplies' || norm === 'home_supplies' || norm === 'homesupplies') {
    return 'Home Improvement';
  }

  return undefined;
}

export function resolveMajorCategory(
  categoryOrSubcategory?: string | null,
  userCategories?: Array<{ name: string; parent_category?: string }>
): string {
  if (!categoryOrSubcategory) return 'Shopping';
  const clean = categoryOrSubcategory.trim();
  if (!clean) return 'Shopping';

  const normKey = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    normKey === 'rentandutilities' ||
    normKey === 'rentutilities' ||
    normKey === 'rentandutilitieswater' ||
    normKey === 'rentutilitieswater'
  ) {
    return 'Bills & Utilities';
  }

  if (normKey === 'homesupplies' || normKey === 'householdsupplies') {
    return 'Home Improvement';
  }

  if (
    normKey === 'personalcare' ||
    normKey === 'generalmerchandise' ||
    normKey === 'other' ||
    normKey === 'uncategorized' ||
    normKey === 'unknown'
  ) {
    return 'Shopping';
  }

  if (normKey === 'foodanddrink' || normKey === 'fooddrink') {
    return 'Food & Dining';
  }

  // If it's already a major category
  const directMatch = CATEGORIES_TAXONOMY.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (directMatch) return directMatch.name;

  // Try subcategory lookup
  const fromSub = getMajorCategoryForSubcategory(clean, userCategories);
  if (fromSub) return fromSub;

  if (clean.toLowerCase().startsWith('other ')) {
    const candidate = clean.slice(6).trim();
    const matched = CATEGORIES_TAXONOMY.find(
      (c) => c.name.toLowerCase() === candidate.toLowerCase()
    );
    if (matched) return matched.name;
    return 'Shopping';
  }

  // If user has a custom top-level category
  if (userCategories) {
    const uc = userCategories.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (uc) return uc.parent_category || uc.name;
  }

  const formatted = formatCategoryName(clean);
  if (formatted === 'Shopping') return 'Shopping';

  // Check if formatCategoryName matches any major category
  const matchFormatted = CATEGORIES_TAXONOMY.find(
    (c) => c.name.toLowerCase() === formatted.toLowerCase()
  );
  if (matchFormatted) return matchFormatted.name;

  return formatted;
}

export function isSpendingExcludedCategory(category: string | undefined | null): boolean {
  if (!category) return false;
  const resolved = resolveMajorCategory(category);
  if (['Transfer', 'Tax Refund', 'Earned Income'].includes(resolved)) {
    return true;
  }

  const key = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return [
    'creditcardbill',
    'creditcardbills',
    'creditcardpayment',
    'creditcardpayments',
    'investment',
    'investments',
    'transferin',
    'transferout',
    'loanpaymentscreditcardpayment',
    'income',
    'transfer',
    'transferexcludefrombudget',
    'cashspendingtransfer',
    'cryptodeposit',
    'cryptoother',
    'cryptowithdrawal',
    'investmentdeposit',
    'investmentwithdrawal',
    'mortgagepayment',
    'othertransfer',
    'paycheck',
    'bonus',
  ].includes(key);
}

const PILL_TYPOGRAPHY = 'text-[0.6rem] font-bold uppercase tracking-[0.18em]';

export interface TagTheme {
  key: string;
  tag: string;
  dot: string;
  ring: string;
  ringHex: string;
  selectedTag: string;
}

const TAG_THEMES: TagTheme[] = [
  {
    key: 'sky',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-sky-100 border border-sky-200/70 dark:border-sky-400/30 shadow-[0_18px_52px_-34px_rgba(14,165,233,0.55)] bg-[linear-gradient(130deg,_rgba(14,165,233,0.24),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(130deg,_rgba(56,189,248,0.18),_rgba(56,189,248,0.06))]`,
    dot: 'bg-sky-500/90 dark:bg-sky-300/85',
    ring: 'ring-sky-400',
    ringHex: '#38bdf8',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-sky-500 border border-sky-300 shadow-[0_0_18px_rgba(14,165,233,0.85)] ring-2 ring-sky-300 dark:ring-sky-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'emerald',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-emerald-100 border border-emerald-200/70 dark:border-emerald-400/30 shadow-[0_18px_52px_-34px_rgba(16,185,129,0.55)] bg-[linear-gradient(130deg,_rgba(16,185,129,0.26),_rgba(16,185,129,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,197,94,0.2),_rgba(34,197,94,0.07))]`,
    dot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    ring: 'ring-emerald-400',
    ringHex: '#34d399',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-emerald-500 border border-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.85)] ring-2 ring-emerald-300 dark:ring-emerald-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'cyan',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-cyan-100 border border-cyan-200/70 dark:border-cyan-400/30 shadow-[0_18px_52px_-34px_rgba(6,182,212,0.52)] bg-[linear-gradient(130deg,_rgba(6,182,212,0.25),_rgba(6,182,212,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,211,238,0.18),_rgba(34,211,238,0.06))]`,
    dot: 'bg-cyan-500/90 dark:bg-cyan-300/80',
    ring: 'ring-cyan-400',
    ringHex: '#22d3ee',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-cyan-500 border border-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.85)] ring-2 ring-cyan-300 dark:ring-cyan-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'violet',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-violet-100 border border-violet-200/70 dark:border-violet-400/30 shadow-[0_18px_52px_-34px_rgba(139,92,246,0.54)] bg-[linear-gradient(130deg,_rgba(139,92,246,0.24),_rgba(139,92,246,0.08))] dark:bg-[linear-gradient(130deg,_rgba(167,139,250,0.2),_rgba(167,139,250,0.06))]`,
    dot: 'bg-violet-500/90 dark:bg-violet-300/80',
    ring: 'ring-violet-400',
    ringHex: '#a78bfa',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-violet-600 border border-violet-300 shadow-[0_0_18px_rgba(139,92,246,0.85)] ring-2 ring-violet-300 dark:ring-violet-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'amber',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-amber-100 border border-amber-200/70 dark:border-amber-400/30 shadow-[0_18px_52px_-34px_rgba(245,158,11,0.5)] bg-[linear-gradient(130deg,_rgba(245,158,11,0.26),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,191,36,0.24),_rgba(251,191,36,0.08))]`,
    dot: 'bg-amber-500/90 dark:bg-amber-300/85',
    ring: 'ring-amber-400',
    ringHex: '#fbbf24',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-amber-500 border border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.85)] ring-2 ring-amber-300 dark:ring-amber-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'rose',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-rose-100 border border-rose-200/70 dark:border-rose-400/30 shadow-[0_18px_52px_-34px_rgba(244,63,94,0.5)] bg-[linear-gradient(130deg,_rgba(244,63,94,0.26),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.07))]`,
    dot: 'bg-rose-500/90 dark:bg-rose-300/80',
    ring: 'ring-rose-400',
    ringHex: '#fb7185',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-rose-500 border border-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.85)] ring-2 ring-rose-300 dark:ring-rose-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'indigo',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-indigo-100 border border-indigo-200/70 dark:border-indigo-400/30 shadow-[0_18px_52px_-34px_rgba(99,102,241,0.5)] bg-[linear-gradient(130deg,_rgba(99,102,241,0.26),_rgba(99,102,241,0.08))] dark:bg-[linear-gradient(130deg,_rgba(129,140,248,0.2),_rgba(129,140,248,0.06))]`,
    dot: 'bg-indigo-500/90 dark:bg-indigo-300/80',
    ring: 'ring-indigo-400',
    ringHex: '#818cf8',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-indigo-600 border border-indigo-300 shadow-[0_0_18px_rgba(99,102,241,0.85)] ring-2 ring-indigo-300 dark:ring-indigo-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'fuchsia',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-fuchsia-100 border border-fuchsia-200/70 dark:border-fuchsia-400/30 shadow-[0_18px_52px_-34px_rgba(232,121,249,0.5)] bg-[linear-gradient(130deg,_rgba(232,121,249,0.26),_rgba(232,121,249,0.1))] dark:bg-[linear-gradient(130deg,_rgba(217,70,239,0.2),_rgba(217,70,239,0.06))]`,
    dot: 'bg-fuchsia-500/90 dark:bg-fuchsia-300/80',
    ring: 'ring-fuchsia-400',
    ringHex: '#e879f9',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-fuchsia-600 border border-fuchsia-300 shadow-[0_0_18px_rgba(232,121,249,0.85)] ring-2 ring-fuchsia-300 dark:ring-fuchsia-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'teal',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-teal-100 border border-teal-200/70 dark:border-teal-400/30 shadow-[0_18px_52px_-34px_rgba(20,184,166,0.5)] bg-[linear-gradient(130deg,_rgba(20,184,166,0.25),_rgba(20,184,166,0.09))] dark:bg-[linear-gradient(130deg,_rgba(45,212,191,0.2),_rgba(45,212,191,0.06))]`,
    dot: 'bg-teal-500/90 dark:bg-teal-300/80',
    ring: 'ring-teal-400',
    ringHex: '#2dd4bf',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-teal-500 border border-teal-300 shadow-[0_0_18px_rgba(20,184,166,0.85)] ring-2 ring-teal-300 dark:ring-teal-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
  {
    key: 'lime',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-lime-100 border border-lime-200/70 dark:border-lime-400/30 shadow-[0_18px_52px_-34px_rgba(132,204,22,0.48)] bg-[linear-gradient(130deg,_rgba(132,204,22,0.26),_rgba(132,204,22,0.1))] dark:bg-[linear-gradient(130deg,_rgba(163,230,53,0.2),_rgba(163,230,53,0.06))]`,
    dot: 'bg-lime-500/90 dark:bg-lime-300/80',
    ring: 'ring-lime-400',
    ringHex: '#a3e635',
    selectedTag: `${PILL_TYPOGRAPHY} text-white bg-lime-600 border border-lime-300 shadow-[0_0_18px_rgba(101,163,13,0.85)] ring-2 ring-lime-300 dark:ring-lime-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950 font-extrabold`,
  },
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getTagThemeForCategory(name?: string | null) {
  const key = (name || 'Uncategorized').toLowerCase();
  const idx = hashString(key) % TAG_THEMES.length;
  return TAG_THEMES[idx];
}
