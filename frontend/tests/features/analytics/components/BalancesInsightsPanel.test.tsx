import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BalancesInsightsPanel } from '@/features/analytics/components/BalancesInsightsPanel';
import type { Totals } from '@/types/analytics';
import { text as semanticTextRecipes, status as uiStatusRecipes } from '@/ui/recipes';
import {
  getSessionCollapsibleExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';

const sampleOverall: Totals = {
  cash: 123642.1,
  credit: -4713.4,
  loan: 0,
  investments: 2500,
  positivesTotal: 126142.1,
  negativesTotal: -4713.4,
  net: 121428.7,
  ratio: null,
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('BalancesInsightsPanel', () => {
  beforeEach(() => {
    setViewportWidth(1280);
    window.sessionStorage.clear();
  });

  it('renders net in the shell collapsed by default', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const shell = screen.getByTestId('balances-insights-shell');
    expect(shell).toBeInTheDocument();
    expect(screen.getByText('Balance insights')).toBeInTheDocument();
    expect(shell).toHaveClass('sticky');
    expect(shell).toHaveClass('z-30');
    expect(shell.firstElementChild?.className).toContain('backdrop-blur-md');
    expect(shell.firstElementChild?.className).toContain('--color-surface-glass-panel');
    expect(shell.querySelector('.hero-stat-card__inset-ring')).not.toBeNull();
    expect(screen.getByTestId('overall-net')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /balance insights/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();
  });

  it('keeps the mobile net label and amount on one wrapping row', () => {
    setViewportWidth(390);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const netValue = screen.getByTestId('overall-net');
    const netRow = netValue.parentElement;

    expect(netRow).toHaveClass('grid');
    expect(netRow).toHaveClass('grid-cols-[auto_minmax(0,1fr)]');
    expect(netRow).toHaveClass('items-baseline');
    expect(netValue).toHaveClass('justify-self-end');
    expect(netValue).toHaveClass('text-right');
    expect(within(netRow as HTMLElement).getByText('Net')).toBeInTheDocument();
  });

  it('toggles sub-categories from the net summary', async () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const summaryButton = screen.getByRole('button', { name: /balance insights/i });
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();

    await userEvent.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByTestId('overall-net')).toBeInTheDocument();
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(true);

    await userEvent.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(false);
  });

  it('supports keyboard activation from the summary button', async () => {
    const user = userEvent.setup();

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const summaryButton = screen.getByRole('button', { name: /balance insights/i });
    summaryButton.focus();

    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: /balance insights/i }).getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('restores expanded state from session storage', () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    expect(screen.getByRole('button', { name: /balance insights/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(true);
  });

  it('renders sub-categories without outlines', () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashCard = screen.getByTestId('insight-card-cash');
    expect(cashCard.firstElementChild).not.toHaveClass('border-2');
  });

  it('keeps category glyph and value colors', () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashCard = screen.getByTestId('insight-card-cash');
    const cashValue = within(cashCard).getByTestId('overall-cash');
    expect(cashValue).toHaveClass(uiStatusRecipes.success.text[0]);

    const creditCard = screen.getByTestId('insight-card-credit');
    const creditValue = within(creditCard).getByTestId('overall-credit');
    expect(creditValue).toHaveClass(uiStatusRecipes.danger.text[0]);
  });

  it('lays out desktop sub-categories as content-fit tiles', () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const body = screen.getByTestId('balances-insights-panel-body');
    const tileGrid = body.children.item(1) as HTMLElement | null;
    expect(tileGrid).toBeTruthy();
    expect(tileGrid).toHaveClass('flex-row');
    expect(tileGrid).toHaveClass('items-start');
    expect(tileGrid).toHaveClass('gap-3');

    const cashTile = screen.getByTestId('insight-card-cash');
    expect(cashTile).toHaveClass('md:flex-1');
    expect(cashTile).toHaveClass('md:min-w-0');
  });

  it('renders mobile sub-categories as inline rows', () => {
    setViewportWidth(390);
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashTile = screen.getByTestId('insight-card-cash');
    expect(cashTile).toHaveClass('contents');
    const frontFace = cashTile.querySelector('.grid-cols-subgrid');
    expect(frontFace).toBeTruthy();
  });

  it('clicking a category flips it to show the question', async () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashButton = screen.getByRole('button', { name: /cash/i });
    expect(cashButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(cashButton);
    expect(cashButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders income and expenses YTD when both props are provided', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} incomeYtd={52300} expensesYtd={18400} />);

    const summaryButton = screen.getByRole('button', { name: /balance insights/i });
    const incomeBlock = screen.getByTestId('balances-ytd-income');
    const expensesBlock = screen.getByTestId('balances-ytd-expenses');
    expect(incomeBlock).toHaveClass('items-baseline');
    expect(expensesBlock).toHaveClass('items-baseline');
    expect(incomeBlock).toHaveTextContent('$52,300.00');
    expect(expensesBlock).toHaveTextContent('$18,400.00');
    const incomeLabel = within(summaryButton).getByText('income');
    const expensesLabel = within(summaryButton).getByText('expenses');
    expect(incomeLabel).toHaveClass('font-label');
    expect(incomeLabel).toHaveClass(semanticTextRecipes.label);
    expect(expensesLabel).toHaveClass('font-label');
    expect(expensesLabel).toHaveClass(semanticTextRecipes.label);
    expect(within(incomeBlock).getByTestId('balances-ytd-income-value')).toBeInTheDocument();
    expect(within(incomeBlock).getByText('ytd')).toBeInTheDocument();
    expect(within(expensesBlock).getByTestId('balances-ytd-expenses-value')).toBeInTheDocument();
    expect(within(expensesBlock).getByText('ytd')).toBeInTheDocument();
  });

  it('omits YTD columns when props are absent', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    expect(screen.queryByTestId('balances-ytd-income')).not.toBeInTheDocument();
    expect(screen.queryByTestId('balances-ytd-expenses')).not.toBeInTheDocument();
    expect(screen.getByTestId('overall-net')).toBeInTheDocument();
  });

  it('styles desktop header YTD values as cardTitle with status colors', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} incomeYtd={1000} expensesYtd={500} />);

    const incomeValue = screen.getByTestId('balances-ytd-income-value');
    const expensesValue = screen.getByTestId('balances-ytd-expenses-value');
    expect(incomeValue).toHaveClass('font-card-title');
    expect(incomeValue).toHaveClass(uiStatusRecipes.success.text[0]);
    expect(expensesValue).toHaveClass('font-card-title');
    expect(expensesValue).toHaveClass(uiStatusRecipes.danger.text[0]);
  });

  it('styles mobile body YTD values like balance row amounts', () => {
    setViewportWidth(390);
    setSessionCollapsibleExpanded('balances-insights', true);

    render(<BalancesInsightsPanel overall={sampleOverall} incomeYtd={1000} expensesYtd={500} />);

    const incomeValue = screen.getByTestId('balances-ytd-income-value');
    const expensesValue = screen.getByTestId('balances-ytd-expenses-value');
    const cashValue = screen.getByTestId('overall-cash');

    expect(incomeValue).not.toHaveClass('font-card-title');
    expect(expensesValue).not.toHaveClass('font-card-title');
    expect(incomeValue).toHaveClass(uiStatusRecipes.success.text[0]);
    expect(expensesValue).toHaveClass(uiStatusRecipes.danger.text[0]);
    expect(cashValue).toHaveClass(uiStatusRecipes.success.text[0]);
    expect(cashValue).not.toHaveClass('font-card-title');
  });

  it('resets flipped categories when resetKey changes', async () => {
    setSessionCollapsibleExpanded('balances-insights', true);

    const { rerender } = render(<BalancesInsightsPanel overall={sampleOverall} resetKey="first" />);
    await userEvent.click(screen.getByRole('button', { name: /cash/i }));
    expect(screen.getByRole('button', { name: /cash/i })).toHaveAttribute('aria-expanded', 'true');

    rerender(<BalancesInsightsPanel overall={sampleOverall} resetKey="second" />);
    expect(screen.getByRole('button', { name: /cash/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
