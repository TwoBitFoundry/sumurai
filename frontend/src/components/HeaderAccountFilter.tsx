import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  chromeBar,
  control,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const POPOVER_GAP_PX = 8;

interface HeaderAccountFilterProps {
  triggerStyle?: 'default' | 'icon-only';
}

type PopoverPosition = {
  bottom: number;
  left: number;
};

export function HeaderAccountFilter({ triggerStyle = 'default' }: HeaderAccountFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedBanks, setCollapsedBanks] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
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
      setPopoverPosition({
        bottom: window.innerHeight - triggerRect.top + POPOVER_GAP_PX,
        left: triggerRect.left,
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
    <div className={cn('relative', triggerStyle === 'icon-only' && chromeBar.square)}>
      {triggerStyle === 'icon-only' ? (
        <nav
          className={cn(
            ...appTitleBarRecipes.pillContainer,
            ...appTitleBarRecipes.contextPillInset,
            chromeBar.square,
            'flex',
            'shrink-0',
            'items-center',
            'justify-center'
          )}
          aria-label="Account filter menu"
        >
          <Button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            variant={isOpen ? 'tabActive' : 'tab'}
            size="inherit"
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              'h-full',
              'w-full',
              'min-h-0',
              'p-0',
              isOpen ? uiTextRecipes.inverse : uiTextRecipes.muted
            )}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label="Filter accounts"
          >
            <span className={cn('relative', 'z-10', ...chromeBar.glyphWell)}>
              <Filter className={chromeBar.glyph} />
            </span>
          </Button>
        </nav>
      ) : (
        <Button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          variant="ghost"
          size="md"
          className={cn(
            uiBorderRecipes.default,
            ...uiSurfaceRecipes.mutedChip,
            'backdrop-blur-sm',
            'shadow-none',
            uiTextRecipes.body,
            uiTypographyRecipes.captionStrong
          )}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <Filter className={control.glyph.md} />
          <span>{displayText}</span>
          <ChevronDown
            className={cn(
              control.glyph.md,
              'transition-transform',
              'duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </Button>
      )}

      {mounted &&
        createPortal(
          isOpen && popoverPosition ? (
            <div
              role="dialog"
              aria-label="Account filter"
              onKeyDown={(e) => e.key === 'Escape' && closePopover()}
              style={{
                bottom: popoverPosition.bottom,
                left: popoverPosition.left,
              }}
              className={cn(
                'fixed',
                'w-80',
                'max-h-96',
                'flex',
                'flex-col',
                'overflow-hidden',
                uiRadiusRecipes.standard,
                'border',
                ...uiBorderRecipes.floatingChrome,
                ...uiSurfaceRecipes.floatingChromePanel,
                ...uiEffectRecipes.glassShadow,
                'backdrop-blur-md',
                'backdrop-saturate-[150%]',
                'z-50'
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
                      const displayName =
                        accounts[0]?.institution_name ?? bankName.split('::')[0] ?? bankName;
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
                                uiRadiusRecipes.standard,
                                'transition-all',
                                'duration-200',
                                'ease-out',
                                'active:scale-[0.98]'
                              )}
                              aria-label={
                                isCollapsed ? `Expand ${displayName}` : `Collapse ${displayName}`
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
                              {displayName}
                            </label>
                          </div>

                          {!isCollapsed ? (
                            <div className={cn('ml-11', 'mt-2', 'space-y-2')}>
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
                            </div>
                          ) : null}
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
            </div>
          ) : null,
          document.body
        )}
    </div>
  );
}
