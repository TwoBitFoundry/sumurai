import { render, screen } from '@testing-library/react';
import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';

describe('DashboardChartCard', () => {
  it('renders the widget shell and refreshing state', () => {
    render(
      <DashboardChartCard
        title="Spending Over Time"
        description="Breakdown by category"
        refreshingLabel="Refreshing analytics"
        isRefreshing
      >
        <div>Chart body</div>
      </DashboardChartCard>
    );

    expect(screen.getByText('Spending Over Time')).toBeInTheDocument();
    expect(screen.getByText('Breakdown by category')).toBeInTheDocument();
    expect(screen.getByLabelText('Refreshing analytics')).toBeInTheDocument();
    expect(screen.getByText('Chart body')).toBeInTheDocument();
  });
});
