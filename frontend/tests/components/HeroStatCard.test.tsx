import { render, screen } from '@testing-library/react';
import { Building2 } from 'lucide-react';
import { HeroStatCard } from '@/components/widgets/HeroStatCard';
import { control } from '@/ui/recipes';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    accentIndexByName: new Map([
      ['DINING', 0],
      ['TRAVEL', 1],
    ]),
  }),
}));

describe('HeroStatCard', () => {
  it('sizes stat icons with the shared control glyph scale', () => {
    const { container } = render(
      <HeroStatCard title="Active institutions" icon={<Building2 />} value={2} />
    );

    const svg = container.querySelector('[data-testid="hero-stat-card"] svg');
    expect(svg?.parentElement?.className).toContain(control.glyph.lg);
    expect(svg?.getAttribute('class') ?? '').not.toContain('h-4');
  });

  it('renders the shared scroll footer for subtext', () => {
    render(
      <HeroStatCard
        title="Accounts tracked"
        value={3}
        suffix="accounts"
        subtext="Balances stay in sync automatically"
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer')).toBeInTheDocument();
    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toBeInTheDocument();
    expect(screen.getByText('Balances stay in sync automatically')).toBeInTheDocument();
  });

  it('renders the shared scroll footer for pills', () => {
    render(
      <HeroStatCard
        title="Overages"
        value={2}
        suffix="over budget"
        pills={[
          { label: 'Dining', type: 'category', categoryName: 'DINING' },
          { label: 'Travel', type: 'category', categoryName: 'TRAVEL' },
        ]}
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByTestId('hero-stat-card-footer').querySelector('svg')).toBeNull();
  });

  it('keeps the footer slider full width on desktop', () => {
    render(
      <HeroStatCard
        title="Recurring"
        value={4}
        pills={[{ label: 'Ab Logistics' }, { label: 'Mega Bank' }, { label: 'Yourself' }]}
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toHaveClass('w-full');
    expect(screen.getByTestId('hero-stat-card-footer-scroll')).not.toHaveClass('lg:max-w-[15rem]');
  });

  it('accepts a desktop footer width override', () => {
    render(
      <HeroStatCard
        title="Recurring"
        value={4}
        pills={[{ label: 'Ab Logistics' }, { label: 'Mega Bank' }, { label: 'Yourself' }]}
        footerScrollClassName="lg:max-w-[10rem]"
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toHaveClass('lg:max-w-[10rem]');
  });

  it('omits the scroll footer when there is no subtext or pills', () => {
    render(<HeroStatCard title="Net" value="$1,000" />);

    expect(screen.queryByTestId('hero-stat-card-footer')).not.toBeInTheDocument();
  });

  it('treats an empty pills array as no footer when subtext is absent', () => {
    render(<HeroStatCard title="Largest size" value="$42.00" pills={[]} />);

    expect(screen.queryByTestId('hero-stat-card-footer')).not.toBeInTheDocument();
  });
});
