import { formatIgnoredInstitutionLabel } from '@/features/simplefin/utils/formatIgnoredInstitutionLabel';

describe('formatIgnoredInstitutionLabel', () => {
  it('prefers institution name when present', () => {
    expect(formatIgnoredInstitutionLabel('org.demo.conn', 'Demo Bank')).toBe('Demo Bank');
  });

  it('formats org conn id tail when name is missing', () => {
    expect(formatIgnoredInstitutionLabel('com.demo-bank.conn-abc', null)).toBe('Conn Abc');
  });
});
