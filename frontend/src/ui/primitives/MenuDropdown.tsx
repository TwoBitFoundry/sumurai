import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

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
            className={cn(designTokens.components.menuDropdown.content, contentClassName)}
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
    <button
      type="button"
      className={cn(designTokens.components.menuDropdown.item, className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export default MenuDropdown;
