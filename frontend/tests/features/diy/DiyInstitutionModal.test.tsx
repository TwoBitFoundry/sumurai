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
      expect(DiyService.createInstitution).toHaveBeenCalledWith('My Institution');
    });

    await user.type(screen.getByLabelText('Account name'), 'Checking');
    await user.type(screen.getByLabelText('Mask'), '1234');
    await user.type(screen.getByLabelText('Starting balance'), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    const accountNames = screen.getAllByLabelText('Account name');
    await user.type(accountNames[1], 'Savings');

    const accountTypes = screen.getAllByLabelText('Account type');
    await user.selectOptions(accountTypes[1], 'savings');

    await user.click(screen.getByRole('button', { name: 'Create institution' }));

    await waitFor(() => {
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
      balance: null,
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
    await user.click(screen.getByRole('button', { name: 'Create institution' }));

    await waitFor(() => {
      expect(DiyService.createAccount).toHaveBeenCalledWith('conn-2', {
        name: 'Checking',
        account_type: 'checking',
        mask: null,
        balance: null,
      });
    });
    expect(onComplete).toHaveBeenCalledWith('conn-2');
  });
});
