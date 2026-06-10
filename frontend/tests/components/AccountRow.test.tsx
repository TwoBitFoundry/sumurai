import { render, screen } from '@testing-library/react';
import { AccountRow } from '@/components/AccountRow';
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
});
