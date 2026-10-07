import {
  AdjustmentsHorizontalIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeftRight,
  Briefcase,
  Car,
  DollarSign,
  Film,
  Gift,
  GraduationCap,
  Hammer,
  Heart,
  Home,
  PiggyBank,
  Plane,
  Receipt,
  Scale,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Utensils,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/primitives';
import type { UserCategory } from '../../../types/api';
import {
  CATEGORIES_TAXONOMY,
  formatCategoryName,
  getTagThemeForCategory,
  resolveMajorCategory,
} from '../../../utils/categories';

type OverrideType = 'none' | 'rule' | 'explicit';

interface CategoryDropdownProps {
  currentCategory: string;
  currentSubcategory?: string;
  overrideType: OverrideType;
  merchantName?: string;
  userCategories: UserCategory[];
  onSelect: (categoryName: string, subcategoryName?: string) => Promise<void>;
  onReset: () => Promise<void>;
  onCreateAndSelect: (name: string, parentCategory?: string) => Promise<void>;
  onCreateRule: (pattern: string, categoryName: string, subcategoryName?: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onOpenRulesModal?: () => void;
}

// Icon mapping for each major category
function getCategoryIcon(name: string) {
  const norm = name.toLowerCase();
  if (norm.includes('bill') || norm.includes('util'))
    return <Zap className="h-4 w-4 text-amber-500" />;
  if (norm.includes('childcare')) return <Heart className="h-4 w-4 text-rose-500" />;
  if (norm.includes('earned income')) return <Briefcase className="h-4 w-4 text-emerald-500" />;
  if (norm.includes('education')) return <GraduationCap className="h-4 w-4 text-blue-500" />;
  if (norm.includes('entertainment')) return <Film className="h-4 w-4 text-purple-500" />;
  if (norm.includes('food')) return <Utensils className="h-4 w-4 text-orange-500" />;
  if (norm.includes('gift')) return <Gift className="h-4 w-4 text-pink-500" />;
  if (norm.includes('grocer')) return <ShoppingCart className="h-4 w-4 text-lime-500" />;
  if (norm.includes('improvement')) return <Hammer className="h-4 w-4 text-yellow-600" />;
  if (norm.includes('management')) return <Home className="h-4 w-4 text-indigo-500" />;
  if (norm.includes('insurance')) return <ShieldCheck className="h-4 w-4 text-teal-500" />;
  if (norm.includes('medical')) return <Activity className="h-4 w-4 text-red-500" />;
  if (norm.includes('personal care')) return <Scissors className="h-4 w-4 text-violet-500" />;
  if (norm.includes('pet')) return <Sparkles className="h-4 w-4 text-amber-600" />;
  if (norm.includes('shopping')) return <ShoppingBag className="h-4 w-4 text-cyan-500" />;
  if (norm.includes('tax refund')) return <PiggyBank className="h-4 w-4 text-green-500" />;
  if (norm.includes('tax')) return <Scale className="h-4 w-4 text-red-600" />;
  if (norm.includes('transportation')) return <Car className="h-4 w-4 text-sky-500" />;
  if (norm.includes('transfer')) return <ArrowLeftRight className="h-4 w-4 text-slate-500" />;
  if (norm.includes('travel')) return <Plane className="h-4 w-4 text-indigo-400" />;
  return <Receipt className="h-4 w-4 text-slate-400" />;
}

export function suggestPattern(name: string): string {
  let clean = (name || '').trim();
  if (!clean) return '*';

  // Strip common bank/processor noise prefixes
  clean = clean
    .replace(/^(recurring payment authorized on \d\d\/\d\d\s*)/i, '')
    .replace(/^(purchase authorized on \d\d\/\d\d\s*)/i, '')
    .replace(/^(recurring payment authorized\s*)/i, '')
    .replace(/^(purchase authorized\s*)/i, '')
    .replace(/^(business to business ach\s*)/i, '')
    .replace(/^(checkcard purchase\s*)/i, '')
    .replace(/^(checkcard\s*)/i, '')
    .replace(/^(pos debit\s*)/i, '')
    .replace(/^(debit card purchase\s*)/i, '')
    .replace(/^(purchase\s+)/i, '')
    .replace(/^(aplpay\s+)/i, '')
    .replace(/^(py\s*\*\s*)/i, '')
    .replace(/^(sq\s*\*\s*)/i, '')
    .replace(/^(tst\s*\*\s*)/i, '')
    .trim();

  // Strip store numbers, card masks, phone numbers
  const tokens = clean.split(/\s+/);
  const cut = tokens.findIndex(
    (t) =>
      /^\d{3,}/.test(t) ||
      /^#\d+/.test(t) ||
      /^card\s*\d+/i.test(t) ||
      /^800-|^888-|^877-|^866-/.test(t) ||
      /^s\d{10,}/i.test(t)
  );
  const core = cut > 0 ? tokens.slice(0, cut).join(' ') : clean;
  const trimmed = core.trim().replace(/^[*\s]+|[*\s]+$/g, '');
  if (!trimmed) return '*';
  return `*${trimmed}*`;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  currentCategory,
  currentSubcategory,
  overrideType,
  merchantName,
  userCategories,
  onSelect,
  onReset,
  onCreateAndSelect,
  onCreateRule,
  onDeleteCategory: _onDeleteCategory,
  onOpenRulesModal,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingSubcategoryParent, setAddingSubcategoryParent] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [ruleSubcategory, setRuleSubcategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 440;
    const dropdownWidth = 320;

    // Check if dropdown would overflow bottom of viewport
    let top = rect.bottom + 6;
    if (top + dropdownHeight > window.innerHeight && rect.top - dropdownHeight - 6 > 0) {
      top = rect.top - dropdownHeight - 6;
    }

    // Check if dropdown would overflow right of viewport
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    setDropdownPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-category-dropdown]')
      ) {
        setOpen(false);
        setSearch('');
        setAddingSubcategoryParent(null);
        setNewSubcategoryName('');
        setCreatingRule(false);
        setError(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const resolvedCurrentMajor = useMemo(
    () => resolveMajorCategory(currentCategory),
    [currentCategory]
  );

  const handleSelect = useCallback(
    async (majorCategory: string, subcategory?: string) => {
      setSaving(true);
      setError(null);
      try {
        await onSelect(majorCategory, subcategory);
        setOpen(false);
      } catch {
        setError('Failed to update category.');
      } finally {
        setSaving(false);
      }
    },
    [onSelect]
  );

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await onReset();
      setOpen(false);
    } catch {
      setError('Failed to reset category.');
    } finally {
      setSaving(false);
    }
  }, [onReset]);

  const handleCreateSubcategory = useCallback(
    async (parentCategory: string) => {
      const name = newSubcategoryName.trim();
      if (!name) return;
      setSaving(true);
      setError(null);
      try {
        await onCreateAndSelect(name, parentCategory);
        setNewSubcategoryName('');
        setAddingSubcategoryParent(null);
        setOpen(false);
      } catch {
        setError('Failed to create sub-category.');
      } finally {
        setSaving(false);
      }
    },
    [newSubcategoryName, onCreateAndSelect]
  );

  const handleCreateRule = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const pattern = rulePattern.trim();
      const category = ruleCategory.trim();
      const subcategory = ruleSubcategory.trim() || undefined;
      if (!pattern || !category) return;
      setSaving(true);
      setError(null);
      try {
        await onCreateRule(pattern, category, subcategory);
        setRulePattern('');
        setRuleCategory('');
        setRuleSubcategory('');
        setCreatingRule(false);
        setOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save rule.';
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [rulePattern, ruleCategory, ruleSubcategory, onCreateRule]
  );

  const openRuleForm = useCallback(() => {
    setCreatingRule(true);
    setRulePattern(suggestPattern(merchantName ?? ''));
    setRuleCategory(resolvedCurrentMajor || 'Shopping');
    setRuleSubcategory(currentSubcategory ?? '');
    setError(null);
  }, [merchantName, resolvedCurrentMajor, currentSubcategory]);

  const ruleSubcategoriesList = useMemo(() => {
    if (!ruleCategory) return [];
    const cat = CATEGORIES_TAXONOMY.find(
      (c) => c.name.toLowerCase() === ruleCategory.toLowerCase()
    );
    const customSubs = userCategories
      .filter((uc) => uc.parent_category?.toLowerCase() === ruleCategory.toLowerCase())
      .map((uc) => uc.name);
    return Array.from(new Set([...(cat?.subcategories || []), ...customSubs])).filter(
      (sub) =>
        !sub.toLowerCase().startsWith('other ') &&
        sub.toLowerCase() !== 'other' &&
        sub.toLowerCase() !== 'uncategorized' &&
        sub.toLowerCase() !== 'general merchandise' &&
        sub.toLowerCase() !== 'general_merchandise'
    );
  }, [ruleCategory, userCategories]);

  // Build the hierarchical list combining CATEGORIES_TAXONOMY and userCategories
  const categoriesList = useMemo(() => {
    const list = CATEGORIES_TAXONOMY.map((cat) => {
      const customSubs = userCategories
        .filter((uc) => uc.parent_category?.toLowerCase() === cat.name.toLowerCase())
        .map((uc) => uc.name);

      const combinedSubs = Array.from(new Set([...cat.subcategories, ...customSubs])).filter(
        (sub) =>
          !sub.toLowerCase().startsWith('other ') &&
          sub.toLowerCase() !== 'other' &&
          sub.toLowerCase() !== 'uncategorized' &&
          sub.toLowerCase() !== 'general merchandise' &&
          sub.toLowerCase() !== 'general_merchandise' &&
          (cat.name.toLowerCase() === 'groceries'
            ? true
            : sub.trim().toLowerCase() !== cat.name.toLowerCase())
      );
      return {
        ...cat,
        subcategories: combinedSubs,
      };
    });

    const s = search.trim().toLowerCase();
    if (!s) return list;

    // Filter categories and subcategories
    return list
      .map((cat) => {
        const catMatches = cat.name.toLowerCase().includes(s);
        const filteredSubs = cat.subcategories.filter((sub) => sub.toLowerCase().includes(s));
        if (catMatches) {
          return cat;
        }
        if (filteredSubs.length > 0) {
          return {
            ...cat,
            subcategories: filteredSubs,
          };
        }
        return null;
      })
      .filter((cat): cat is (typeof list)[0] => cat !== null);
  }, [userCategories, search]);

  const catName = formatCategoryName(resolvedCurrentMajor);
  const theme = getTagThemeForCategory(catName);

  // Label shown on button
  const displayLabel = useMemo(() => {
    if (currentSubcategory && currentSubcategory.toLowerCase() !== catName.toLowerCase()) {
      return `${catName} • ${currentSubcategory}`;
    }
    return catName;
  }, [catName, currentSubcategory]);

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          data-category-dropdown
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
          }}
          className={cn(
            'flex flex-col w-80 max-h-[440px] overflow-hidden rounded-2xl',
            'border border-slate-200/90 bg-white/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-xl',
            'dark:border-slate-700/90 dark:bg-slate-900/95 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]'
          )}
        >
          {/* Search bar */}
          <div className="relative border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category"
              className={cn(
                'w-full rounded-xl bg-slate-100/80 py-1.5 pl-8 pr-3 text-xs text-slate-800',
                'placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/70',
                'dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800'
              )}
            />
          </div>

          {/* Quick actions: Reset or Rule */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {overrideType === 'explicit' ? (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400"
              >
                <XMarkIcon className="h-3 w-3" />
                Reset override
              </button>
            ) : overrideType === 'rule' ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  <AdjustmentsHorizontalIcon className="h-3 w-3" />
                  Rule matched
                </span>
                {onOpenRulesModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenRulesModal();
                    }}
                    className="text-[10px] text-violet-500 underline hover:text-violet-700 dark:text-violet-400 cursor-pointer"
                  >
                    View rules
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Categories
              </span>
            )}

            <button
              type="button"
              onClick={openRuleForm}
              className="flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              <AdjustmentsHorizontalIcon className="h-3 w-3" />
              {overrideType === 'rule' ? 'Edit rule' : 'Auto-rule'}
            </button>
          </div>

          {/* Error notice */}
          {error && (
            <div className="bg-red-50 px-3 py-1 text-[11px] text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Create rule panel */}
          {creatingRule ? (
            <form
              onSubmit={handleCreateRule}
              className="flex flex-col gap-2 p-3 bg-violet-50/50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-violet-900 dark:text-violet-200">
                  Auto-rule for merchant
                </span>
                <button
                  type="button"
                  onClick={() => setCreatingRule(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                  Merchant Pattern
                </label>
                <input
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  placeholder="Merchant pattern (e.g. *STARBUCKS*)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                    Category
                  </label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => {
                      setRuleCategory(e.target.value);
                      setRuleSubcategory('');
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {CATEGORIES_TAXONOMY.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                    Subcategory
                  </label>
                  <select
                    value={ruleSubcategory}
                    onChange={(e) => setRuleSubcategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">No subcategory</option>
                    {ruleSubcategoriesList.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving || !rulePattern.trim() || !ruleCategory.trim()}
                className="mt-1 rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Rule'}
              </button>
            </form>
          ) : (
            /* Categories & Subcategories Tree */
            <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
              {categoriesList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching categories found
                </div>
              ) : (
                categoriesList.map((cat) => {
                  const isCurrentMajor =
                    resolvedCurrentMajor.toLowerCase() === cat.name.toLowerCase();

                  return (
                    <div key={cat.name} className="mb-2">
                      {/* Major Category Header (can click to select category directly) */}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSelect(cat.name, undefined)}
                        className={cn(
                          'sticky top-0 z-10 flex w-full items-center gap-2 rounded-lg bg-white/95 px-2 py-1.5 text-left text-xs font-semibold backdrop-blur-md transition-colors dark:bg-slate-900/95',
                          isCurrentMajor &&
                            (!currentSubcategory ||
                              currentSubcategory.toLowerCase() === cat.name.toLowerCase())
                            ? 'text-sky-600 dark:text-sky-400 bg-sky-50/80 dark:bg-sky-950/50'
                            : 'text-slate-900 hover:bg-slate-100/70 dark:text-slate-100 dark:hover:bg-slate-800/60'
                        )}
                        title={`Select ${cat.name}`}
                      >
                        {getCategoryIcon(cat.name)}
                        <span className="flex-1 truncate">
                          {cat.name}{' '}
                          <span className="font-normal text-[11px] text-slate-400">
                            ({cat.type})
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all',
                            isCurrentMajor &&
                              (!currentSubcategory ||
                                currentSubcategory.toLowerCase() === cat.name.toLowerCase())
                              ? 'border-sky-500 bg-sky-500 text-white dark:border-sky-400 dark:bg-sky-400'
                              : 'border-slate-300 dark:border-slate-600'
                          )}
                        >
                          {isCurrentMajor &&
                            (!currentSubcategory ||
                              currentSubcategory.toLowerCase() === cat.name.toLowerCase()) && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                        </span>
                      </button>

                      {/* Sub-categories */}
                      <div className="ml-5 space-y-0.5 border-l border-slate-100 pl-2 dark:border-slate-800">
                        {cat.subcategories.map((sub) => {
                          const isSelected =
                            isCurrentMajor &&
                            currentSubcategory?.toLowerCase() === sub.toLowerCase();

                          return (
                            <button
                              key={sub}
                              type="button"
                              disabled={saving}
                              onClick={() => handleSelect(cat.name, sub)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors',
                                isSelected
                                  ? 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                              )}
                            >
                              <span className="truncate">{sub}</span>
                              {/* Radio indicator matching screenshot */}
                              <span
                                className={cn(
                                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all',
                                  isSelected
                                    ? 'border-sky-500 bg-sky-500 text-white dark:border-sky-400 dark:bg-sky-400'
                                    : 'border-slate-300 dark:border-slate-600'
                                )}
                              >
                                {isSelected && <CheckIcon className="h-2.5 w-2.5 stroke-[3]" />}
                              </span>
                            </button>
                          );
                        })}

                        {/* + Add Sub Category button */}
                        {addingSubcategoryParent === cat.name ? (
                          <div className="mt-1 flex items-center gap-1 px-1">
                            <input
                              autoFocus
                              type="text"
                              value={newSubcategoryName}
                              onChange={(e) => setNewSubcategoryName(e.target.value)}
                              placeholder="New sub-category..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateSubcategory(cat.name);
                                } else if (e.key === 'Escape') {
                                  setAddingSubcategoryParent(null);
                                }
                              }}
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              disabled={saving || !newSubcategoryName.trim()}
                              onClick={() => handleCreateSubcategory(cat.name)}
                              className="rounded-md bg-sky-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSubcategoryParent(null);
                                setNewSubcategoryName('');
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubcategoryParent(cat.name);
                              setNewSubcategoryName('');
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                          >
                            <PlusIcon className="h-3 w-3" />
                            Add Sub Category
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Change category: ${displayLabel}`}
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        className={cn(
          'group/cat inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 transition-all duration-200',
          'backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          'hover:ring-2 hover:ring-sky-400/60 dark:hover:ring-sky-400/50 cursor-pointer',
          theme.tag
        )}
      >
        <span
          className={`h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)] ${theme.dot}`}
          aria-hidden="true"
        />
        <span className="max-w-[170px] truncate">{displayLabel}</span>
        {overrideType === 'rule' && (
          <span
            title="Auto-categorized by rule"
            className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-violet-100/90 px-1 py-0.2 text-[9px] font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
          >
            <AdjustmentsHorizontalIcon className="h-2.5 w-2.5" />
            <span>rule</span>
          </span>
        )}
        {overrideType === 'explicit' && (
          <span
            title="Manually set override"
            className="ml-0.5 text-[9px] font-semibold opacity-60"
          >
            ✎
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  );
};

export default CategoryDropdown;
