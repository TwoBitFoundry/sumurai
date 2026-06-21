import type { ThemePreference } from '@/ui/tokens';
import type { CustomDateRangeBounds, DateRangeKey } from '@/utils/dateRanges';

const SESSION_KEYS = {
  theme: 'sumurai.ui.theme',
  dashboardDateRange: 'sumurai.ui.dashboardDateRange',
  dashboardCustomDateRange: 'sumurai.ui.dashboardCustomDateRange',
  transactionsCategory: 'sumurai.ui.transactionsCategory',
  transactionsSearch: 'sumurai.ui.transactionsSearch',
  accountsBankExpanded: 'sumurai.ui.accountsBankExpanded',
  budgetsSectionExpanded: 'sumurai.ui.budgetsSectionExpanded',
  collapsibleExpanded: 'sumurai.ui.collapsibleExpanded',
} as const;

function readBooleanRecord(key: string): Record<string, boolean> | null {
  return readJson<Record<string, boolean>>(key, (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, boolean>;
  });
}

function readCollapsibleExpandedMap(): Record<string, boolean> {
  const current = readBooleanRecord(SESSION_KEYS.collapsibleExpanded) ?? {};
  const legacy = readBooleanRecord(SESSION_KEYS.budgetsSectionExpanded);
  if (!legacy) {
    return current;
  }
  return { ...legacy, ...current };
}

export function hasSessionCollapsibleExpanded(sectionId: string): boolean {
  const map = readCollapsibleExpandedMap();
  if (sectionId === 'fixed-expenses' && map[sectionId] !== true && map.subscriptions === true) {
    return true;
  }
  return Object.hasOwn(map, sectionId);
}

function writeCollapsibleExpandedMap(map: Record<string, boolean>): void {
  if (Object.keys(map).length === 0) {
    removeItem(SESSION_KEYS.collapsibleExpanded);
    return;
  }
  writeJson(SESSION_KEYS.collapsibleExpanded, map);
}

const DATE_RANGE_KEYS: DateRangeKey[] = [
  'current-month',
  'last-month',
  'ytd',
  'custom',
  'past-2-months',
  'past-3-months',
  'past-6-months',
  'past-year',
  'all-time',
];

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readItem(key: string): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }
  return window.sessionStorage.getItem(key);
}

function writeItem(key: string, value: string): void {
  if (!canUseSessionStorage()) {
    return;
  }
  window.sessionStorage.setItem(key, value);
}

function removeItem(key: string): void {
  if (!canUseSessionStorage()) {
    return;
  }
  window.sessionStorage.removeItem(key);
}

function readJson<T>(key: string, parse: (value: unknown) => T | null): T | null {
  const raw = readItem(key);
  if (!raw) {
    return null;
  }
  try {
    return parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  writeItem(key, JSON.stringify(value));
}

function isThemePreference(value: string): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isCustomDateRangeBounds(value: unknown): value is CustomDateRangeBounds {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as CustomDateRangeBounds;
  return typeof candidate.start === 'string' && typeof candidate.end === 'string';
}

function isDateRangeKey(value: string): value is DateRangeKey {
  return DATE_RANGE_KEYS.includes(value as DateRangeKey);
}

export function getSessionThemePreference(): ThemePreference | null {
  const stored = readItem(SESSION_KEYS.theme);
  if (!stored || !isThemePreference(stored)) {
    return null;
  }
  return stored;
}

export function setSessionThemePreference(preference: ThemePreference): void {
  writeItem(SESSION_KEYS.theme, preference);
}

export function getSessionDashboardDateRange(): DateRangeKey | null {
  const stored = readItem(SESSION_KEYS.dashboardDateRange);
  if (!stored || !isDateRangeKey(stored)) {
    return null;
  }
  return stored;
}

export function setSessionDashboardDateRange(dateRange: DateRangeKey): void {
  writeItem(SESSION_KEYS.dashboardDateRange, dateRange);
}

export function getSessionDashboardCustomDateRange(): CustomDateRangeBounds | null {
  return readJson(SESSION_KEYS.dashboardCustomDateRange, (value) => {
    if (!isCustomDateRangeBounds(value)) {
      return null;
    }
    return value;
  });
}

export function setSessionDashboardCustomDateRange(
  customDateRange: CustomDateRangeBounds | null
): void {
  if (!customDateRange) {
    removeItem(SESSION_KEYS.dashboardCustomDateRange);
    return;
  }
  writeJson(SESSION_KEYS.dashboardCustomDateRange, customDateRange);
}

export function getSessionTransactionsSearch(): string | null {
  const stored = readItem(SESSION_KEYS.transactionsSearch);
  return stored === null ? null : stored;
}

export function setSessionTransactionsSearch(search: string): void {
  if (!search) {
    removeItem(SESSION_KEYS.transactionsSearch);
    return;
  }
  writeItem(SESSION_KEYS.transactionsSearch, search);
}

export function getSessionTransactionsCategory(): string | null {
  const stored = readItem(SESSION_KEYS.transactionsCategory);
  if (stored === null) {
    return null;
  }
  if (stored === '') {
    return null;
  }
  return stored;
}

export function setSessionTransactionsCategory(category: string | null): void {
  if (!category) {
    removeItem(SESSION_KEYS.transactionsCategory);
    return;
  }
  writeItem(SESSION_KEYS.transactionsCategory, category);
}

export function getSessionBankExpanded(bankId: string): boolean {
  const map = readJson<Record<string, boolean>>(SESSION_KEYS.accountsBankExpanded, (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, boolean>;
  });
  if (!map || typeof map[bankId] !== 'boolean') {
    return false;
  }
  return map[bankId];
}

export function setSessionBankExpanded(bankId: string, expanded: boolean): void {
  const map =
    readJson<Record<string, boolean>>(SESSION_KEYS.accountsBankExpanded, (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }
      return value as Record<string, boolean>;
    }) ?? {};

  if (expanded) {
    map[bankId] = true;
  } else {
    delete map[bankId];
  }

  if (Object.keys(map).length === 0) {
    removeItem(SESSION_KEYS.accountsBankExpanded);
    return;
  }

  writeJson(SESSION_KEYS.accountsBankExpanded, map);
}

export function getSessionCollapsibleExpanded(sectionId: string): boolean {
  const map = readCollapsibleExpandedMap();
  if (sectionId === 'fixed-expenses' && map[sectionId] !== true && map.subscriptions === true) {
    return true;
  }

  return map[sectionId] === true;
}

export function setSessionCollapsibleExpanded(sectionId: string, expanded: boolean): void {
  const map = readBooleanRecord(SESSION_KEYS.collapsibleExpanded) ?? {};

  if (expanded) {
    map[sectionId] = true;
  } else {
    delete map[sectionId];
  }

  writeCollapsibleExpandedMap(map);
}

export function getSessionBudgetsSectionExpanded(sectionId: string): boolean {
  return getSessionCollapsibleExpanded(sectionId);
}

export function setSessionBudgetsSectionExpanded(sectionId: string, expanded: boolean): void {
  setSessionCollapsibleExpanded(sectionId, expanded);
}
