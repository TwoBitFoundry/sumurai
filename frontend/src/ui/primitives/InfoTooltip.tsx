import { Info } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './utils';

export interface InfoTooltipProps {
  /** The text or elements to display inside the tooltip popover */
  content: React.ReactNode;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Optional custom class for the trigger button */
  className?: string;
  /** Optional custom class for the icon */
  iconClassName?: string;
  /** Optional custom class for the tooltip popover */
  contentClassName?: string;
  /** Preferred placement: 'top' or 'bottom'. Defaults to 'top' */
  preferredPosition?: 'top' | 'bottom';
}

export function InfoTooltip({
  content,
  ariaLabel = 'More information',
  className,
  iconClassName,
  contentClassName,
  preferredPosition = 'top',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 260;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 60;
    const padding = 12;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - tooltipWidth;
    }

    let top: number;
    const fitsTop = rect.top - tooltipHeight - 8 > padding;
    if (preferredPosition === 'top' && fitsTop) {
      top = rect.top - tooltipHeight - 8;
    } else if (preferredPosition === 'bottom' || !fitsTop) {
      top = rect.bottom + 8;
    } else {
      top = rect.top - tooltipHeight - 8;
    }

    setCoords({ top, left });
  }, [preferredPosition]);

  const show = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const hide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }, []);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResizeOrScroll = () => updatePosition();
      window.addEventListener('resize', handleResizeOrScroll);
      window.addEventListener('scroll', handleResizeOrScroll, true);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      const handlePointerDown = (e: PointerEvent) => {
        if (
          triggerRef.current?.contains(e.target as Node) ||
          tooltipRef.current?.contains(e.target as Node)
        ) {
          return;
        }
        setIsOpen(false);
      };
      document.addEventListener('pointerdown', handlePointerDown);

      return () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll, true);
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('pointerdown', handlePointerDown);
      };
    }
  }, [isOpen, updatePosition]);

  // Re-adjust coords when tooltip node mounts
  useEffect(() => {
    if (isOpen && tooltipRef.current) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={toggle}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-full p-0.5 text-slate-400 hover:text-slate-600',
          'dark:text-slate-500 dark:hover:text-slate-300',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
          className
        )}
      >
        <Info className={cn('h-3.5 w-3.5 flex-shrink-0', iconClassName)} />
      </button>

      {mounted &&
        isOpen &&
        coords &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={cn(
              'z-[9999] w-max max-w-xs',
              'rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2',
              'text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-700',
              'shadow-[0_12px_30px_-10px_rgba(15,23,42,0.3)] backdrop-blur-md',
              'dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-200 dark:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.7)]',
              'animate-in fade-in zoom-in-95 duration-150',
              contentClassName
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

export default InfoTooltip;
