import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BalancesInsightsPanel } from '@/features/analytics/components/BalancesInsightsPanel';
import type { Totals } from '@/types/analytics';
import { status as uiStatusRecipes } from '@/ui/recipes';

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
  });

  it('renders net in the shell expanded by default', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    expect(screen.getByTestId('balances-insights-shell')).toBeInTheDocument();
    expect(screen.getByTestId('overall-net')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /net worth summary/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Investments')).toBeInTheDocument();
    expect(screen.getByText('Credit')).toBeInTheDocument();
    expect(screen.getByText('Loans')).toBeInTheDocument();
  });

  it('toggles sub-categories from the net summary', async () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const summaryButton = screen.getByRole('button', { name: /net worth summary/i });
    expect(screen.getByText('Cash')).toBeInTheDocument();

    await userEvent.click(summaryButton);

    expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('overall-net')).toBeInTheDocument();
  });

  it('renders sub-categories without outlines', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashCard = screen.getByTestId('insight-card-cash');
    expect(cashCard.firstElementChild).not.toHaveClass('border-2');
  });

  it('keeps category glyph and value colors', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashCard = screen.getByTestId('insight-card-cash');
    const cashValue = within(cashCard).getByTestId('overall-cash');
    expect(cashValue).toHaveClass(uiStatusRecipes.success.text[0]);

    const creditCard = screen.getByTestId('insight-card-credit');
    const creditValue = within(creditCard).getByTestId('overall-credit');
    expect(creditValue).toHaveClass(uiStatusRecipes.danger.text[0]);
  });

  it('lays out desktop sub-categories as content-fit tiles', () => {
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

    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashTile = screen.getByTestId('insight-card-cash');
    expect(cashTile).toHaveClass('contents');
    const frontFace = cashTile.querySelector('.grid-cols-subgrid');
    expect(frontFace).toBeTruthy();
  });

  it('clicking a category flips it to show the question', async () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    const cashButton = screen.getByRole('button', { name: /cash/i });
    expect(cashButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(cashButton);
    expect(cashButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders income and expenses YTD when both props are provided', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} incomeYtd={52300} expensesYtd={18400} />);

    expect(screen.getByTestId('balances-ytd-income')).toHaveTextContent('$52,300.00');
    expect(screen.getByTestId('balances-ytd-expenses')).toHaveTextContent('$18,400.00');
    expect(screen.getByText('income ytd')).toBeInTheDocument();
    expect(screen.getByText('expenses ytd')).toBeInTheDocument();
  });

  it('omits YTD row when props are absent', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} />);

    expect(screen.queryByTestId('balances-ytd-row')).not.toBeInTheDocument();
  });

  it('colors YTD income success and expenses danger', () => {
    render(<BalancesInsightsPanel overall={sampleOverall} incomeYtd={1000} expensesYtd={500} />);

    expect(screen.getByTestId('balances-ytd-income-value')).toHaveClass(
      uiStatusRecipes.success.text[0]
    );
    expect(screen.getByTestId('balances-ytd-expenses-value')).toHaveClass(
      uiStatusRecipes.danger.text[0]
    );
  });

  it('resets flipped categories when resetKey changes', async () => {
    const { rerender } = render(<BalancesInsightsPanel overall={sampleOverall} resetKey="first" />);
    await userEvent.click(screen.getByRole('button', { name: /cash/i }));
    expect(screen.getByRole('button', { name: /cash/i })).toHaveAttribute('aria-expanded', 'true');

    rerender(<BalancesInsightsPanel overall={sampleOverall} resetKey="second" />);
    expect(screen.getByRole('button', { name: /cash/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
