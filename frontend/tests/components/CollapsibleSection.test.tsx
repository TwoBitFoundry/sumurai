import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import {
  getSessionCollapsibleExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';

jest.mock('@/utils/sessionPreferences', () => {
  const actual = jest.requireActual(
    '@/utils/sessionPreferences'
  ) as typeof import('@/utils/sessionPreferences');
  return {
    ...actual,
    getSessionCollapsibleExpanded: jest.fn(actual.getSessionCollapsibleExpanded),
    setSessionCollapsibleExpanded: jest.fn(actual.setSessionCollapsibleExpanded),
  };
});

describe('CollapsibleSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('hides section content until expanded', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection
        sectionId="budgets"
        title="Budgets"
        description="Manage category budgets."
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
      >
        <div data-testid="budgets-content">Budget content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Budgets')).toBeInTheDocument();
    expect(screen.queryByTestId('budgets-content')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show budgets' }));

    expect(screen.getByTestId('budgets-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide budgets' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(setSessionCollapsibleExpanded).toHaveBeenCalledWith('budgets', true);
  });

  it('restores expanded state from session storage', async () => {
    setSessionCollapsibleExpanded('budgets', true);

    render(
      <CollapsibleSection
        sectionId="budgets"
        title="Budgets"
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
      >
        <div data-testid="budgets-content">Budget content</div>
      </CollapsibleSection>
    );

    await waitFor(() => {
      expect(screen.getByTestId('budgets-content')).toBeInTheDocument();
    });
    expect(getSessionCollapsibleExpanded('budgets')).toBe(true);
  });
});
