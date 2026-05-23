import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleFinIgnoredInstitutionsPanel } from '@/features/simplefin/components/SimpleFinIgnoredInstitutionsPanel';

describe('SimpleFinIgnoredInstitutionsPanel', () => {
  it('renders ignored institutions and restores one when requested', async () => {
    const user = userEvent.setup();
    const onRestore = jest.fn();

    render(
      <SimpleFinIgnoredInstitutionsPanel
        institutions={[
          {
            org_conn_id: 'org-1',
            institution_name: 'Demo Bank',
            hidden_at: '2025-01-01T00:00:00Z',
          },
        ]}
        onRestore={onRestore}
        restoringOrgConnId={null}
        isOnline={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /show again/i }));

    expect(onRestore).toHaveBeenCalledWith('org-1');
  });
});
