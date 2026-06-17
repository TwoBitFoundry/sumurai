import { render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import { TopMerchantsList } from '@/features/analytics/components/TopMerchantsList';
import { sampleTopMerchants } from '@/storybook/fixtures/analytics';
import { getThemeColors, heroAccents } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useTransactionListLauncher', () => ({
  useTransactionListLauncher: () => ({
    openTransactionList: jest.fn(),
    close: jest.fn(),
  }),
}));

describe('TopMerchantsList', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: getThemeColors('light'),
    } as any);
  });

  it('keeps merchant row shells flat without elevation drop shadow', () => {
    render(
      <TopMerchantsList
        merchants={[{ name: 'Expedia', amount: 842.5, count: 3, percentage: 18 }]}
      />
    );

    const merchantRow = screen.getByText('Expedia').closest('.hero-stat-card');
    expect(merchantRow?.className).toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]'
    );
    expect(merchantRow?.className).not.toMatch(/drop-shadow-\[/);
    expect(merchantRow?.className).toContain('border-[var(--color-border-subtle)]');
  });

  it('uses one column on mobile and two columns on tablet and desktop', () => {
    const { container } = render(<TopMerchantsList merchants={sampleTopMerchants} />);

    expect(container.firstElementChild).toHaveClass('flex', 'flex-col');
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(screen.getByText('Corner Market')).toBeInTheDocument();
    const merchantRow = screen.getByText('Corner Market').closest('.hero-stat-card');
    expect(merchantRow?.querySelector('.hero-stat-card__inset-ring')).toHaveStyle({
      boxShadow: `inset 0 0 0 2px ${heroAccents.violet.ringHex}`,
    });
    expect(
      screen.getByText('Corner Market').closest('div[class*="grid-cols-[minmax"]')
    ).toHaveTextContent('14tx');
  });
});
