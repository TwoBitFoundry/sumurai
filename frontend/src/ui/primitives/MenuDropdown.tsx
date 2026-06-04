import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  floatingChromeGlass,
  focus as focusRecipes,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

const MENU_POPOVER_GAP_PX = 8;

export const menuDropdownRecipes = {
  content: [
    'fixed z-50 w-48 max-w-[calc(100vw-1rem)]',
    `overflow-hidden ${uiRadiusRecipes.standard}`,
    ...floatingChromeGlass.backdrop,
    ...floatingChromeGlass.shell,
    'p-2',
    'backdrop-blur-md',
    'backdrop-saturate-[150%]',
  ],
  item: [
    'flex w-full items-center gap-2',
    `px-3 py-2 ${uiRadiusRecipes.standard}`,
    `text-left ${semanticTextRecipes.muted}`,
    'border border-transparent',
    'bg-transparent',
    'transition-all duration-200 ease-out active:scale-[0.98] disabled:active:scale-100',
    'hover:border-[var(--color-border-default)]',
    'hover:bg-[var(--color-surface-hover-row)]',
    'active:border-[var(--color-border-default)]',
    'active:bg-[var(--color-surface-hover-row)]',
    focusRecipes.visible,
    'dark:text-slate-300',
    'dark:hover:border-[var(--color-border-divider)]',
    'dark:hover:bg-[var(--color-surface-hover-row)]',
    'dark:active:border-[var(--color-border-divider)]',
    'dark:active:bg-[var(--color-surface-hover-row)]',
  ],
} as const;

export interface MenuDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Dropdown menu for action lists.
 *
 * @example
 * ```tsx
 * <MenuDropdown trigger={<button>Menu</button>}>
 *   <MenuItem icon={<Icon />}>Action 1</MenuItem>
 *   <MenuItem icon={<Icon />}>Action 2</MenuItem>
 * </MenuDropdown>
 * ```
 *
 * @param trigger - Element that opens menu when clicked
 * @param contentClassName - Applied to dropdown content container
 *
 * @see {@link ../README.md} for detailed documentation
 */
export function MenuDropdown({
  trigger,
  children,
  className,
  contentClassName,
}: MenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; right: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const triggerElement = triggerRef.current;
    if (!triggerElement || typeof window === 'undefined') {
      return;
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    setPopoverPosition({
      top: triggerRect.bottom + MENU_POPOVER_GAP_PX,
      right: Math.max(MENU_POPOVER_GAP_PX, window.innerWidth - triggerRect.right),
    });
  }, []);

  const handleTriggerClick = (event: React.MouseEvent) => {
    if (
      isValidElement<{ onClick?: React.MouseEventHandler }>(trigger) &&
      typeof trigger.props.onClick === 'function'
    ) {
      trigger.props.onClick(event);
    }
    setOpen((v) => !v);
  };

  const triggerNode = isValidElement<{ onClick?: React.MouseEventHandler }>(trigger) ? (
    cloneElement(trigger as React.ReactElement<any>, {
      onClick: handleTriggerClick,
      ref: triggerRef,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
    })
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleTriggerClick}
      aria-haspopup="menu"
      aria-expanded={open}
    >
      {trigger}
    </button>
  );

  const menuChildren = Children.map(children, (child) => {
    if (!isValidElement<{ onClick?: React.MouseEventHandler }>(child)) {
      return child;
    }
    const childOnClick = child.props.onClick;
    return cloneElement(child, {
      onClick: (event: React.MouseEvent) => {
        childOnClick?.(event);
        setOpen(false);
      },
    });
  });

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }

    updatePosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleScroll = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, updatePosition]);

  return (
    <div className={cn('relative inline-flex', className)}>
      {triggerNode}
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && popoverPosition ? (
                <motion.div
                  ref={menuRef}
                  role="menu"
                  aria-label="Action menu"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
                  style={{
                    top: popoverPosition.top,
                    right: popoverPosition.right,
                  }}
                  className={cn(menuDropdownRecipes.content, contentClassName)}
                >
                  {menuChildren}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Menu item for use within MenuDropdown.
 *
 * @example
 * ```tsx
 * <MenuItem icon={<UserIcon />} onClick={handleClick}>
 *   Profile
 * </MenuItem>
 * ```
 */
export function MenuItem({ icon, children, className, ...props }: MenuItemProps) {
  return (
    <button type="button" className={cn(menuDropdownRecipes.item, className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

export default MenuDropdown;
