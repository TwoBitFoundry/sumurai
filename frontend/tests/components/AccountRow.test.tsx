import { render, screen } from '@testing-library/react';
import { AccountRow } from '@/components/AccountRow';
import { heroAccents } from '@/ui/tokens';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

function renderAccountRow(transactions?: number) {
  return render(
    <ThemeTestProvider>
      <AccountRow
        account={{
          id: 'acct-1',
          name: 'Everyday Checking',
          mask: '4821',
          type: 'checking',
          balance: 2450.12,
          transactions,
        }}
        isOnline
      />
    </ThemeTestProvider>
  );
}

describe('AccountRow', () => {
  it('renders transaction count with tx suffix', () => {
    renderAccountRow(95);

    expect(screen.getByText('tx').parentElement).toHaveTextContent('95tx');
  });

  it('renders zero transaction count with tx suffix when transactions are missing', () => {
    renderAccountRow();

    expect(screen.getByText('tx').parentElement).toHaveTextContent('0tx');
  });

  it('uses the violet hero inset ring on hover', () => {
    const { container } = renderAccountRow(12);

    const insetRing = container.querySelector('.hero-stat-card__inset-ring');
    expect(insetRing).toHaveClass('group-hover:opacity-100');
    expect((insetRing as HTMLElement).style.boxShadow).toBe(
      `inset 0 0 0 2px ${heroAccents.violet.ringHex}`
    );
  });
});
