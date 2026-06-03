import { render, screen } from '@testing-library/react';
import { SIMPLEFIN_BRIDGE_ACCOUNT_URL } from '@/features/simplefin/constants';
import { formatSyncAllRowDetail } from '@/features/sync/utils/formatSyncAllRowDetail';

describe('formatSyncAllRowDetail', () => {
  it('renders the SimpleFIN auth-required link copy', () => {
    render(
      <>
        {formatSyncAllRowDetail({
          id: 'row-1',
          provider: 'simplefin',
          institutionName: 'Demo Bank',
          connectionId: 'conn-1',
          status: 'auth_required',
          detail: 'Connection needs attention.',
          transactionCount: null,
          retryAfterSeconds: null,
        })}
      </>
    );

    expect(screen.getByText(/connection needs attention/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /open dashboard/i })).toHaveAttribute(
      'href',
      SIMPLEFIN_BRIDGE_ACCOUNT_URL
    );
  });

  it('renders a local-time rate-limit message', () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-06-02T10:00:00.000Z').getTime());

    render(
      <>
        {formatSyncAllRowDetail({
          id: 'row-2',
          provider: 'plaid',
          institutionName: 'Demo Bank',
          connectionId: 'conn-2',
          status: 'rate_limited',
          detail: null,
          transactionCount: null,
          retryAfterSeconds: 3600,
        })}
      </>
    );

    expect(screen.getByText(/daily sync limit reached/i)).toBeVisible();
    expect(screen.getByText(/try again tomorrow after/i)).toBeVisible();

    nowSpy.mockRestore();
  });

  it('describes synced rows as new transactions', () => {
    render(
      <>
        {formatSyncAllRowDetail({
          id: 'row-3',
          provider: 'plaid',
          institutionName: 'Demo Bank',
          connectionId: 'conn-3',
          status: 'synced',
          detail: null,
          transactionCount: 2,
          retryAfterSeconds: null,
        })}
      </>
    );

    expect(screen.getByText('Synced 2 new transactions')).toBeVisible();
  });

  it('describes zero synced rows explicitly', () => {
    render(
      <>
        {formatSyncAllRowDetail({
          id: 'row-4',
          provider: 'teller',
          institutionName: 'Demo Bank',
          connectionId: 'conn-4',
          status: 'synced',
          detail: null,
          transactionCount: 0,
          retryAfterSeconds: null,
        })}
      </>
    );

    expect(screen.getByText('Synced 0 new transactions')).toBeVisible();
  });

  it('does not invent fallback copy when a row has no detail', () => {
    const { container } = render(
      <>
        {formatSyncAllRowDetail({
          id: 'row-5',
          provider: 'plaid',
          institutionName: 'Demo Bank',
          connectionId: 'conn-5',
          status: 'error',
          detail: null,
          transactionCount: null,
          retryAfterSeconds: null,
        })}
      </>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
