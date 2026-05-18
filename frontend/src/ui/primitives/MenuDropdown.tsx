import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const menuDropdownRecipes = {
  content: [
    'absolute right-0 z-20 mt-3 w-48',
    `overflow-hidden ${uiRadiusRecipes.standard}`,
    ...semanticBorders.glass,
    ...semanticSurfaces.solidPanel,
    'p-2',
    ...semanticEffects.glassShadow,
    'backdrop-blur-md',
    'dark:shadow-[0_28px_70px_-36px_var(--color-effect-glass-shadow)]',
  ],
  item: [
    'flex w-full items-center gap-2',
    `px-3 py-2 ${uiRadiusRecipes.standard}`,
    `text-left ${semanticTextRecipes.muted}`,
    'transition-all duration-200 ease-out',
    ...semanticSurfaces.hoverRow,
    'dark:text-slate-300',
    'dark:hover:bg-[var(--color-surface-hover-row)]',
  ],
} as const;

export interface MenuDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Dropdown menu with animated open/close transitions.
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
    cloneElement(trigger, { onClick: handleTriggerClick })
  ) : (
    <button type="button" onClick={handleTriggerClick}>
      {trigger}
    </button>
  );

  return (
    <div className={cn('relative', className)}>
      {triggerNode}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(menuDropdownRecipes.content, contentClassName)}
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
