import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightsExpandablePanel } from '@/components/widgets/InsightsExpandablePanel';

describe('InsightsExpandablePanel', () => {
  it('keeps the summary button and reveal body in one expandable unit', async () => {
    const onToggle = jest.fn();

    render(
      <InsightsExpandablePanel
        testId="expandable-insights"
        bodyId="expandable-insights-body"
        bodyTestId="expandable-insights-body"
        summaryLabel="Balances Now"
        summary={<div>Summary</div>}
        expanded={false}
        onToggle={onToggle}
      >
        <div>Details</div>
      </InsightsExpandablePanel>
    );

    const toggle = screen.getByRole('button', { name: 'Balances Now' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('title', 'Balances Now');
    expect(screen.queryByTestId('expandable-insights-body')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard activation from the summary button', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();

    render(
      <InsightsExpandablePanel
        testId="expandable-insights"
        bodyId="expandable-insights-body"
        bodyTestId="expandable-insights-body"
        summaryLabel="Balances Now"
        summary={<div>Summary</div>}
        expanded={false}
        onToggle={onToggle}
      >
        <div>Details</div>
      </InsightsExpandablePanel>
    );

    const toggle = screen.getByRole('button', { name: 'Balances Now' });

    toggle.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
