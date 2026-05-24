import type { SimpleFinInstitutionAuthRequired } from '@/types/api';

export function formatSimpleFinAuthRequiredToast(
  institutions: SimpleFinInstitutionAuthRequired[]
): string {
  if (institutions.length === 0) {
    return '';
  }

  if (institutions.length === 1) {
    return `${institutions[0].institution_name} needs to be re-authenticated in your SimpleFIN dashboard.`;
  }

  const names = institutions.map((institution) => institution.institution_name).join(', ');
  return `These institutions need re-authentication in your SimpleFIN dashboard: ${names}.`;
}
