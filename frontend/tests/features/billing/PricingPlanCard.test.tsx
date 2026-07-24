import { render, screen } from '@testing-library/react';
import { FlaskConical } from 'lucide-react';
import { PricingPlanCard } from '@/features/billing/PricingPlanCard';

describe('PricingPlanCard', () => {
  it('uses the nested card surface for feature rows', () => {
    render(
      <PricingPlanCard
        meta="Explore"
        title="Demo mode"
        detail="Safe sample data."
        icon={FlaskConical}
        features={['Play around with demo data']}
      >
        <button type="button">Continue</button>
      </PricingPlanCard>
    );

    const featureRow = screen.getByText('Play around with demo data').parentElement;
    expect(featureRow?.className).toContain('bg-[var(--color-surface-card)]');
    expect(featureRow?.className).not.toContain('bg-[var(--color-surface-data-row)]');
  });
});
