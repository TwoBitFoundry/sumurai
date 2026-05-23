export function formatIgnoredInstitutionLabel(
  orgConnId: string,
  institutionName: string | null | undefined
): string {
  if (institutionName?.trim()) {
    return institutionName.trim();
  }

  const segment = orgConnId.includes('.') ? (orgConnId.split('.').pop() ?? orgConnId) : orgConnId;

  return segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
