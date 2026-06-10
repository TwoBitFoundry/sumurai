import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { BudgetInsightsPanel } from '@/features/budgets/components/BudgetInsightsPanel';
import { text as uiTextRecipes } from '@/ui/recipes';
import {
  getSessionCollapsibleExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';

const baseInsights: BudgetInsights = {
  dailyPacing: 15,
  income: 5000,
  freeSpend: 250,
  runoutDate: new Date(2026, 5, 25),
  hasActivity: true,
};

const defaultProps = {
  totalBudgeted: 500,
  totalSpent: 250,
  insights: baseInsights,
  subscriptions: [],
  month: new Date(2026, 5, 1),
  filterKey: 'all',
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('BudgetInsightsPanel', () => {
  beforeEach(() => {
    setViewportWidth(1280);
    window.sessionStorage.clear();
  });

  it('renders the combined shell collapsed by default', () => {
    render(<BudgetInsightsPanel {...defaultProps} />);

    expect(screen.getByTestId('budget-insights-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /budget summary/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Runway')).not.toBeInTheDocument();
    expect(screen.queryByText('Free Spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Sub Costs')).not.toBeInTheDocument();
  });

  it('restores expanded state from session storage', () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);

    expect(screen.getByRole('button', { name: /budget summary/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Runway')).toBeInTheDocument();
    expect(getSessionCollapsibleExpanded('budget-insights')).toBe(true);
  });

  it('toggles the shell open and closed from the summary', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);

    const summaryButton = screen.getByRole('button', { name: /budget summary/i });
    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Runway')).not.toBeInTheDocument();

    await userEvent.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Runway')).toBeInTheDocument();
    expect(getSessionCollapsibleExpanded('budget-insights')).toBe(true);

    await userEvent.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    expect(getSessionCollapsibleExpanded('budget-insights')).toBe(false);
  });

  it('lays out the detail cards as three content-fit tiles on tablet and desktop', () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);

    const body = screen.getByTestId('budget-insights-panel-body');
    expect(body.querySelector('.border-t')).toBeTruthy();
    const tileGrid = body.children.item(1) as HTMLElement | null;
    expect(tileGrid).toBeTruthy();
    expect(tileGrid).toHaveClass('flex-row');
    expect(tileGrid).toHaveClass('items-start');
    expect(tileGrid).toHaveClass('gap-3');

    const runwayTile = screen.getByTestId('insight-card-runway');
    expect(runwayTile).toHaveClass('md:flex-1');
    expect(runwayTile).toHaveClass('md:min-w-0');
    expect(runwayTile.firstElementChild).toHaveClass('md:self-start');
    const runwayLabel = within(runwayTile).getByText('Runway');
    expect(runwayLabel.className).toContain('whitespace-nowrap');
    expect(runwayLabel.parentElement).toHaveClass('items-center');
    expect(runwayLabel.parentElement).not.toHaveClass('flex-col');
  });

  it('renders mobile detail cards as inline rows', () => {
    setViewportWidth(390);
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);

    const runwayTile = screen.getByTestId('insight-card-runway');
    expect(runwayTile).not.toHaveClass('md:flex-1');
    expect(runwayTile).toHaveClass('contents');
    const frontFace = runwayTile.querySelector('.grid-cols-subgrid');
    expect(frontFace).toBeTruthy();
    expect(frontFace?.className).toContain('items-baseline');
    expect(frontFace?.className).not.toContain('flex-col');
  });

  it('aligns the mobile detail rows in a shared content-fit grid', () => {
    setViewportWidth(390);
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);

    const body = screen.getByTestId('budget-insights-panel-body');
    const grid = body.children.item(1) as HTMLElement | null;
    expect(grid).toBeTruthy();
    expect(grid).toHaveClass('grid');
    expect(grid?.className).toContain('grid-cols-[auto_1fr_auto_auto_auto]');
  });

  it('clicking a card flips it to show the question', async () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);
    const dailyPacingButton = screen.getByRole('button', { name: /runway/i });
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(dailyPacingButton);
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a flipped card returns it to the front', async () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /runway/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('a different card is not affected when one is flipped', async () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /runway/i }));
    expect(screen.getByRole('button', { name: /free spend/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('resets all flipped cards when filterKey changes', async () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    const { rerender } = render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /runway/i }));
    expect(screen.getByRole('button', { name: /runway/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    rerender(<BudgetInsightsPanel {...defaultProps} filterKey="account-123" />);
    expect(screen.getByRole('button', { name: /runway/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('highlights negative free spend in red', () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(
      <BudgetInsightsPanel
        {...defaultProps}
        insights={{ ...baseInsights, income: 1000, freeSpend: -150 }}
      />
    );

    const freeSpendCard = screen.getByTestId('insight-card-free-spend');
    const freeSpendAmount = within(freeSpendCard).getByText('-$150.00');
    expect(freeSpendAmount).toHaveClass(uiTextRecipes.danger);
  });

  it('shows zero-activity fallback while keeping the shell visible', () => {
    setSessionCollapsibleExpanded('budget-insights', true);

    render(
      <BudgetInsightsPanel {...defaultProps} insights={{ ...baseInsights, hasActivity: false }} />
    );

    expect(screen.getByTestId('budget-insights-shell')).toBeInTheDocument();
    expect(screen.getByTestId('budget-insights-empty')).toBeInTheDocument();
    expect(screen.queryByText('Runway')).not.toBeInTheDocument();
  });
});
