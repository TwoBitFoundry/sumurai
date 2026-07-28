import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanSectionView, type PlanSectionViewProps } from '@/features/settings/PlanSectionView';
import type { PlanPolicy } from '@/features/settings/planPolicy';

const demoPolicy: PlanPolicy = {
  planLabel: 'Demo mode',
  introCopy: 'Explore sample data, then subscribe when you are ready for live accounts.',
  statusCopy: 'Ready to connect live accounts?',
  detail: 'Start a trial or upgrade to leave sample data behind.',
  highlights: [
    'Connect your own financial accounts',
    'Replace sample balances and transactions',
    'Use Premium planning workflows',
  ],
  paymentMethodRequired: false,
  canCancel: false,
  alert: null,
  actions: [
    { id: 'start_trial', label: 'Start free trial', variant: 'secondary' },
    { id: 'upgrade_premium', label: 'Upgrade to Premium', variant: 'primary' },
  ],
};

const callbacks = {
  onRetry: jest.fn(),
  onSwitchSelfHosted: jest.fn(),
  onStartTrial: jest.fn(),
  onUpgradePremium: jest.fn(),
  onUpdatePaymentMethod: jest.fn(),
  onCancelMembership: jest.fn(),
  onManageBilling: jest.fn(),
};

const renderView = (props: Partial<PlanSectionViewProps> = {}) =>
  render(
    <PlanSectionView
      policy={demoPolicy}
      isLoading={false}
      queryError={null}
      isEmpty={false}
      mutationPending={false}
      mutationError={null}
      {...callbacks}
      {...props}
    />
  );

describe('PlanSectionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders resolved plan copy and routes actions through callbacks', async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.getByRole('heading', { name: 'Choose your Path' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Demo mode' })).toBeInTheDocument();
    expect(screen.getByText('Ready to connect live accounts?')).toBeInTheDocument();
    expect(screen.getByText('Connect your own financial accounts')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start free trial' }));
    await user.click(screen.getByRole('button', { name: 'Upgrade to Premium' }));

    expect(callbacks.onStartTrial).toHaveBeenCalledTimes(1);
    expect(callbacks.onUpgradePremium).toHaveBeenCalledTimes(1);
  });

  it('renders loading, query-error retry, empty, mutation-pending, and mutation-error states', async () => {
    const user = userEvent.setup();
    const { rerender } = renderView({ policy: null, isLoading: true });
    expect(screen.getByText('Loading plan…')).toBeInTheDocument();

    rerender(
      <PlanSectionView
        {...callbacks}
        policy={null}
        isLoading={false}
        queryError="Billing could not be reached."
        isEmpty={false}
        mutationPending={false}
        mutationError={null}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Billing could not be reached.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(callbacks.onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <PlanSectionView
        {...callbacks}
        policy={null}
        isLoading={false}
        queryError={null}
        isEmpty
        mutationPending={false}
        mutationError={null}
      />
    );
    expect(screen.getByText('No plan information is available.')).toBeInTheDocument();

    rerender(
      <PlanSectionView
        {...callbacks}
        policy={demoPolicy}
        isLoading={false}
        queryError={null}
        isEmpty={false}
        mutationPending
        mutationError="The plan update failed."
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Updating plan…');
    expect(screen.getByRole('alert')).toHaveTextContent('The plan update failed.');
    expect(screen.getByRole('button', { name: 'Start free trial' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upgrade to Premium' })).toBeDisabled();
  });

  it('renders policy alerts and every supported action without new status pills', () => {
    renderView({
      policy: {
        ...demoPolicy,
        alert: {
          variant: 'error',
          title: 'Payment past due',
          message: 'Update your payment method to restore Premium access.',
        },
        actions: [
          { id: 'switch_self_hosted', label: 'Upgrade', variant: 'primary' },
          { id: 'update_payment_method', label: 'Update payment method', variant: 'primary' },
          { id: 'cancel_membership', label: 'Cancel membership', variant: 'danger' },
          { id: 'manage_billing', label: 'Manage billing', variant: 'secondary' },
        ],
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Payment past due');
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update payment method' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
    expect(screen.queryByTestId('plan-status-pill')).not.toBeInTheDocument();
  });

  it('renders nothing only when no visible or explicit state is supplied', () => {
    const { container } = renderView({ policy: null });
    expect(container).toBeEmptyDOMElement();
  });
});
