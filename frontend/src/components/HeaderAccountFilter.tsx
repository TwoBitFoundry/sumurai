import { AnimatePresence, motion } from 'framer-motion';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { cn } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const POPOVER_GAP_PX = 8;

export function HeaderAccountFilter() {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedBanks, setCollapsedBanks] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; right: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const {
    isAllAccountsSelected,
    selectedAccountIds,
    allAccountIds,
    accountsByBank,
    loading,
    toggleBank,
    toggleAccount,
  } = useAccountFilter();

  const totalAccounts = allAccountIds.length;
  const selectedCount = selectedAccountIds.length;

  const displayText = (() => {
    if (totalAccounts === 0) {
      return loading ? 'Loading accounts...' : 'No accounts';
    }
    if (selectedCount === 0) {
      return 'No accounts selected';
    }
    if (isAllAccountsSelected) {
      return 'Filter';
    }
    return `${selectedCount} ${selectedCount === 1 ? 'account' : 'accounts'}`;
  })();

  const closePopover = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const toggleBankCollapse = (bankName: string) => {
    setCollapsedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(bankName)) {
        next.delete(bankName);
      } else {
        next.add(bankName);
      }
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      closePopover();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dialog = document.querySelector('[role="dialog"]');

      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dialog &&
        !dialog.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const header = trigger.closest('header');
      const headerBottom = header ? header.getBoundingClientRect().bottom : triggerRect.bottom;
      setPopoverPosition({
        top: headerBottom + POPOVER_GAP_PX,
        right: Math.max(0, window.innerWidth - triggerRect.right),
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative')}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'rounded-xl',
          'border',
          ...uiBorderRecipes.default,
          ...uiSurfaceRecipes.mutedChip,
          'backdrop-blur-sm',
          'hover:bg-[var(--color-surface-hover-row)]',
          'dark:hover:bg-[var(--color-surface-hover-row)]',
          'transition-all',
          'duration-200',
          'flex',
          'items-center',
          'gap-2',
          uiTextRecipes.body,
          uiTypographyRecipes.captionStrong,
          'px-3 py-1.5'
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Building2 className={cn('h-4', 'w-4')} />
        <span>{displayText}</span>
        <ChevronDown
          className={cn(
            'h-4',
            'w-4',
            'transition-transform',
            'duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && popoverPosition && (
              <motion.div
                role="dialog"
                aria-label="Account filter"
                onKeyDown={(e) => e.key === 'Escape' && closePopover()}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ top: popoverPosition.top, right: popoverPosition.right }}
                className={cn(
                  'fixed',
                  'w-80',
                  'max-h-96',
                  'flex',
                  'flex-col',
                  'overflow-hidden',
                  'rounded-xl',
                  'border',
                  ...uiBorderRecipes.glass,
                  ...uiSurfaceRecipes.card,
                  ...uiEffectRecipes.glassShadow,
                  'backdrop-blur-md',
                  'backdrop-saturate-[150%]',
                  'z-50',
                  'origin-top'
                )}
              >
                <div className={cn('p-4', 'border-b', ...uiBorderRecipes.divider)}>
                  <div className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>
                    Filter by account
                  </div>
                </div>

                <div className={cn('overflow-y-auto', 'flex-1', 'p-4')}>
                  {loading ? (
                    <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                      Loading accounts...
                    </div>
                  ) : (
                    <div className={cn('space-y-2')}>
                      {Object.entries(accountsByBank).map(([bankName, accounts]) => {
                        const bankAccountIds = accounts.map((account) => account.id);
                        const allBankAccountsSelected = bankAccountIds.every((id) =>
                          selectedAccountIds.includes(id)
                        );
                        const someBankAccountsSelected = bankAccountIds.some((id) =>
                          selectedAccountIds.includes(id)
                        );
                        const isCollapsed = collapsedBanks.has(bankName);

                        return (
                          <div
                            key={bankName}
                            className={cn(
                              'border-t',
                              ...uiBorderRecipes.divider,
                              'pt-2',
                              'first:border-t-0',
                              'first:pt-0'
                            )}
                          >
                            <div className={cn('flex', 'items-center', 'gap-2')}>
                              <button
                                type="button"
                                onClick={() => toggleBankCollapse(bankName)}
                                className={cn(
                                  'p-1',
                                  'hover:bg-[var(--color-surface-hover-row)]',
                                  'dark:hover:bg-[var(--color-surface-hover-row)]',
                                  'rounded',
                                  'transition-colors'
                                )}
                                aria-label={
                                  isCollapsed ? `Expand ${bankName}` : `Collapse ${bankName}`
                                }
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-4',
                                    'w-4',
                                    uiTextRecipes.muted,
                                    'transition-transform',
                                    !isCollapsed && 'rotate-90'
                                  )}
                                />
                              </button>
                              <input
                                type="checkbox"
                                id={`bank-${bankName}`}
                                checked={allBankAccountsSelected}
                                ref={(input) => {
                                  if (input)
                                    input.indeterminate =
                                      someBankAccountsSelected && !allBankAccountsSelected;
                                }}
                                onChange={() => toggleBank(bankName)}
                                className={cn(
                                  'rounded',
                                  ...uiBorderRecipes.control,
                                  'text-primary-600',
                                  'focus:ring-primary-500'
                                )}
                              />
                              <label
                                htmlFor={`bank-${bankName}`}
                                className={cn(
                                  uiTypographyRecipes.captionStrong,
                                  uiTextRecipes.primary,
                                  'flex-1',
                                  'cursor-pointer'
                                )}
                              >
                                {bankName}
                              </label>
                            </div>

                            <AnimatePresence initial={false}>
                              {!isCollapsed && (
                                <motion.div
                                  key="accounts"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                  className={cn('ml-11', 'mt-2', 'space-y-2', 'overflow-hidden')}
                                >
                                  {accounts.map((account) => (
                                    <div
                                      key={account.id}
                                      className={cn('flex', 'items-center', 'gap-2')}
                                    >
                                      <input
                                        type="checkbox"
                                        id={`account-${account.id}`}
                                        checked={selectedAccountIds.includes(account.id)}
                                        onChange={() => toggleAccount(account.id)}
                                        className={cn(
                                          'rounded',
                                          ...uiBorderRecipes.control,
                                          'text-primary-600',
                                          'focus:ring-primary-500'
                                        )}
                                      />
                                      <label
                                        htmlFor={`account-${account.id}`}
                                        className={cn(
                                          uiTypographyRecipes.caption,
                                          uiTextRecipes.muted,
                                          'cursor-pointer'
                                        )}
                                      >
                                        {account.name}
                                      </label>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {Object.keys(accountsByBank).length === 0 && !loading && (
                        <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                          No accounts available.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
