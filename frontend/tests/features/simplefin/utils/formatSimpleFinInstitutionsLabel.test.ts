import { formatSimpleFinInstitutionsLabel } from '@/features/simplefin/utils/formatSimpleFinInstitutionsLabel';

describe('formatSimpleFinInstitutionsLabel', () => {
  it('formats singular and plural institution counts', () => {
    expect(formatSimpleFinInstitutionsLabel(1)).toBe('1 institution connected');
    expect(formatSimpleFinInstitutionsLabel(3)).toBe('3 institutions connected');
  });
});
