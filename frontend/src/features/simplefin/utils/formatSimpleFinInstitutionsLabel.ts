export function formatSimpleFinInstitutionsLabel(count: number): string {
  if (count <= 0) {
    return '0 institutions connected';
  }
  return `${count} institution${count === 1 ? '' : 's'} connected`;
}
