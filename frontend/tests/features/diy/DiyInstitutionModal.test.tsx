import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiyInstitutionModal } from '@/features/diy/DiyInstitutionModal';
import { DiyService } from '@/services/DiyService';
import { ThemeTestProvider } from '../../utils/ThemeTestProvider';

jest.mock('@/services/DiyService', () => ({
  DiyService: {
    createInstitution: jest.fn(),
    createAccount: jest.fn(),
  },
}));

describe('DiyInstitutionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects duplicate institution names before creating an institution', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal
          isOpen
          existingInstitutionNames={['My Institution']}
          onClose={jest.fn()}
          onComplete={jest.fn()}
        />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'my institution');

    expect(screen.getByText('An institution with this name already exists.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(DiyService.createInstitution).not.toHaveBeenCalled();
  });

  it('returns to the institution step when Back is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Account name')).toBeInTheDocument();
    });
    expect(DiyService.createInstitution).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Institution name')).toHaveValue('My Institution');

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Account name')).toBeInTheDocument();
    });
    expect(DiyService.createInstitution).not.toHaveBeenCalled();
  });

  it('creates an institution, adds multiple accounts, and completes with the connection id', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    jest.mocked(DiyService.createInstitution).mockResolvedValue({ connection_id: 'conn-1' });
    jest.mocked(DiyService.createAccount).mockResolvedValue({
      id: 'acc-1',
      name: 'Checking',
      account_type: 'checking',
    });

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={onComplete} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Account name')).toBeInTheDocument();
    });
    expect(DiyService.createInstitution).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Account name'), 'Checking');
    await user.type(screen.getByLabelText('Mask'), '1234');
    await user.type(screen.getByLabelText('Current balance'), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    const accountNames = screen.getAllByLabelText('Account name');
    await user.type(accountNames[1], 'Savings');

    const accountTypes = screen.getAllByLabelText('Account type');
    await user.selectOptions(accountTypes[1], 'savings');

    const balanceInputs = screen.getAllByLabelText('Current balance');
    await user.type(balanceInputs[1], '500');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(DiyService.createInstitution).toHaveBeenCalledWith('My Institution');
      expect(DiyService.createAccount).toHaveBeenCalledTimes(2);
    });

    expect(DiyService.createAccount).toHaveBeenNthCalledWith(1, 'conn-1', {
      name: 'Checking',
      account_type: 'checking',
      mask: '1234',
      balance: '1000.00',
    });
    expect(DiyService.createAccount).toHaveBeenNthCalledWith(2, 'conn-1', {
      name: 'Savings',
      account_type: 'savings',
      mask: null,
      balance: '500',
    });
    expect(onComplete).toHaveBeenCalledWith('conn-1');
  });

  it('skips the institution step when reopening an existing DIY institution', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    jest.mocked(DiyService.createAccount).mockResolvedValue({
      id: 'acc-2',
      name: 'Checking',
      account_type: 'checking',
    });

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal
          isOpen
          connectionId="conn-2"
          institutionName="Existing Institution"
          onClose={jest.fn()}
          onComplete={onComplete}
        />
      </ThemeTestProvider>
    );

    expect(screen.queryByLabelText('Institution name')).not.toBeInTheDocument();
    expect(screen.getByText('Existing Institution')).toBeVisible();

    await user.type(screen.getByLabelText('Account name'), 'Checking');
    await user.type(screen.getByLabelText('Current balance'), '250');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(DiyService.createAccount).toHaveBeenCalledWith('conn-2', {
        name: 'Checking',
        account_type: 'checking',
        mask: null,
        balance: '250',
      });
    });
    expect(DiyService.createInstitution).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith('conn-2');
  });

  it('rejects duplicate account names and masks within the institution', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal
          isOpen
          connectionId="conn-1"
          institutionName="My Bank"
          existingInstitutionAccounts={[{ name: 'Checking', mask: '1234' }]}
          onClose={jest.fn()}
          onComplete={jest.fn()}
        />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Account name'), 'checking');
    await user.type(screen.getByLabelText('Mask'), '1234');

    expect(
      screen.getByText('An account with this name already exists in this institution.')
    ).toBeVisible();
    expect(
      screen.getByText('An account with this mask already exists in this institution.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(DiyService.createAccount).not.toHaveBeenCalled();
  });

  it('rejects duplicate account names across multiple drafts', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Account name'), 'Checking');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    const accountNames = screen.getAllByLabelText('Account name');
    await user.type(accountNames[1], 'checking');

    expect(
      screen.getAllByText('An account with this name already exists in this institution.')
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('rejects missing balances before creating accounts', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Account name'), 'Checking');

    expect(screen.getByText('Enter a balance.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(DiyService.createInstitution).not.toHaveBeenCalled();
    expect(DiyService.createAccount).not.toHaveBeenCalled();
  });

  it('rejects invalid balances before creating accounts', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Account name'), 'Checking');
    await user.type(screen.getByLabelText('Current balance'), '.');

    expect(screen.getByText('Enter a valid balance.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(DiyService.createInstitution).not.toHaveBeenCalled();
    expect(DiyService.createAccount).not.toHaveBeenCalled();
  });

  it('keeps the starting balance numeric', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <DiyInstitutionModal isOpen onClose={jest.fn()} onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.type(screen.getByLabelText('Institution name'), 'My Institution');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const balanceInput = screen.getByLabelText('Current balance');
    await user.type(balanceInput, '12ab3.4x5');

    expect(balanceInput).toHaveValue('123.45');
  });
});
