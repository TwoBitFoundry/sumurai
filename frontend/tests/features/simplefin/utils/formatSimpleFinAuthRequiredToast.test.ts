import { formatSimpleFinAuthRequiredToast } from '@/features/simplefin/utils/formatSimpleFinAuthRequiredToast';

describe('formatSimpleFinAuthRequiredToast', () => {
  it('returns empty string when no institutions need auth', () => {
    expect(formatSimpleFinAuthRequiredToast([])).toBe('');
  });

  it('formats a single institution message', () => {
    expect(
      formatSimpleFinAuthRequiredToast([
        {
          institution_name: 'Bank of Oklahoma',
          org_conn_id: 'bok',
          message: 'Connection to Bank of Oklahoma may need attention. Auth required',
        },
      ])
    ).toBe('Bank of Oklahoma needs to be re-authenticated in your SimpleFIN dashboard.');
  });

  it('formats multiple institutions into one toast', () => {
    expect(
      formatSimpleFinAuthRequiredToast([
        {
          institution_name: 'Bank A',
          message: 'Auth required',
        },
        {
          institution_name: 'Bank B',
          message: 'Auth required',
        },
      ])
    ).toBe(
      'These institutions need re-authentication in your SimpleFIN dashboard: Bank A, Bank B.'
    );
  });
});
