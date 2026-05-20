export const heroStatSemanticThemes = {
  success: {
    wrapper:
      'border border-[var(--color-status-success-border)] text-[var(--color-status-success-text)] bg-[linear-gradient(135deg,_rgba(16,185,129,0.24),_rgba(16,185,129,0.1))] dark:bg-[color:color-mix(in_srgb,var(--color-status-success-strong-surface)_55%,transparent)] shadow-[0_14px_40px_-28px_rgba(16,185,129,0.52)] backdrop-blur-sm',
    dot: 'bg-[var(--color-status-success-icon)]',
  },
  info: {
    wrapper:
      'border border-[var(--color-status-info-border)] text-[var(--color-status-info-text)] bg-[linear-gradient(135deg,_rgba(14,165,233,0.22),_rgba(14,165,233,0.08))] dark:bg-[color:color-mix(in_srgb,var(--color-status-info-strong-surface)_55%,transparent)] shadow-[0_14px_40px_-28px_rgba(14,165,233,0.52)] backdrop-blur-sm',
    dot: 'bg-[var(--color-status-info-icon)]',
  },
  warning: {
    wrapper:
      'border border-[var(--color-status-warning-border)] text-[var(--color-status-warning-text)] bg-[linear-gradient(135deg,_rgba(245,158,11,0.24),_rgba(245,158,11,0.1))] dark:bg-[color:color-mix(in_srgb,var(--color-status-warning-strong-surface)_55%,transparent)] shadow-[0_14px_40px_-28px_rgba(245,158,11,0.5)] backdrop-blur-sm',
    dot: 'bg-[var(--color-status-warning-icon)]',
  },
  danger: {
    wrapper:
      'border border-[var(--color-status-danger-border)] text-[var(--color-status-danger-text)] bg-[linear-gradient(135deg,_rgba(244,63,94,0.24),_rgba(244,63,94,0.1))] dark:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_55%,transparent)] shadow-[0_14px_40px_-28px_rgba(244,63,94,0.48)] backdrop-blur-sm',
    dot: 'bg-[var(--color-status-danger-icon)]',
  },
} as const;
