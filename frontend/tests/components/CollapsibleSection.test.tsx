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
    expect(screen.getByRole('button', { name: 'Show budgets' })).toHaveAttribute(
      'title',
      'Show budgets'
    );

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

  it('toggles expansion when clicking the split-header chevron', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection
        sectionId="budgets"
        title="Budgets"
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
        actionsEnd={
          <span aria-hidden className="inline-block h-9 w-9 shrink-0 pointer-events-none" />
        }
      >
        <div data-testid="budgets-content">Budget content</div>
      </CollapsibleSection>
    );

    await user.click(screen.getByRole('button', { name: 'Show budgets' }));

    expect(screen.getByTestId('budgets-content')).toBeInTheDocument();
    expect(
      screen.getByTestId('budgets-section').querySelector('.lucide-chevron-down')
    ).toBeTruthy();
  });

  it('keeps split header actions clickable while the title area toggles expansion', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();

    render(
      <CollapsibleSection
        sectionId="budgets"
        title="Budgets"
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
        actionsStart={
          <button type="button" onClick={onEdit}>
            Edit budgets
          </button>
        }
      >
        <div data-testid="budgets-content">Budget content</div>
      </CollapsibleSection>
    );

    await user.click(screen.getByRole('button', { name: 'Edit budgets' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('budgets-content')).not.toBeInTheDocument();
  });

  it('places split header actions inline with the title', () => {
    const { container } = render(
      <CollapsibleSection
        sectionId="budgets"
        title="Budgets"
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
        actionsStart={<button type="button">Edit budgets</button>}
        actionsEnd={<button type="button">Add budget</button>}
      >
        <div>Budget content</div>
      </CollapsibleSection>
    );

    const headerRow = screen.getByRole('heading', { name: 'Budgets' }).parentElement?.parentElement
      ?.parentElement;
    expect(headerRow).toHaveTextContent('Edit budgets');
    expect(headerRow).toHaveTextContent('Add budget');
    expect(container.querySelector('.flex-wrap')).toBeNull();
  });

  it('supports keyboard activation on the title area', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection
        sectionId="keyboard-toggle"
        title="Budgets"
        testId="budgets-section"
        expandLabel="Show budgets"
        collapseLabel="Hide budgets"
      >
        <div data-testid="budgets-content">Budget content</div>
      </CollapsibleSection>
    );

    const toggle = screen.getByRole('button', { name: 'Show budgets' });
    toggle.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Hide budgets' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Show budgets' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
