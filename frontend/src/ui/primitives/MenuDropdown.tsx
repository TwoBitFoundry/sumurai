import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn, transitionClasses } from './utils'

export interface MenuDropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
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
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'absolute right-0 z-20 mt-3 w-48',
              'overflow-hidden rounded-2xl',
              'border border-white/45 bg-white/95',
              'p-2',
              'shadow-[0_22px_60px_-32px_rgba(15,23,42,0.45)]',
              'backdrop-blur-md',
              'dark:border-white/12 dark:bg-[#0f172a]/92',
              'dark:shadow-[0_28px_70px_-36px_rgba(2,6,23,0.7)]',
              contentClassName
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children: React.ReactNode
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
export function MenuItem({
  icon,
  children,
  className,
  ...props
}: MenuItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2',
        'rounded-xl px-3 py-2',
        'text-left text-slate-600',
        transitionClasses,
        'hover:bg-slate-50',
        'dark:text-slate-300',
        'dark:hover:bg-[#1e293b]',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export default MenuDropdown
