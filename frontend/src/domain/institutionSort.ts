export function compareInstitutionNames(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}
