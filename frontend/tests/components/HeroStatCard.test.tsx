import { render, screen } from '@testing-library/react';
import { HeroStatCard } from '@/components/widgets/HeroStatCard';

describe('HeroStatCard', () => {
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
        pills={[{ label: 'Dining' }, { label: 'Travel' }]}
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('caps the footer slider width on desktop', () => {
    render(
      <HeroStatCard
        title="Recurring"
        value={4}
        pills={[{ label: 'Ab Logistics' }, { label: 'Mega Bank' }, { label: 'Yourself' }]}
      />
    );

    expect(screen.getByTestId('hero-stat-card-footer-scroll')).toHaveClass('lg:max-w-[15rem]');
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
