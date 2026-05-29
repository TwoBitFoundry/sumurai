export const LAST_PASSKEY_REMOVE_TOOLTIP = 'Enroll another passkey before removing this one.';

export function canRemovePasskey(passkeyCount: number): boolean {
  return passkeyCount > 1;
}

export function formatPasskeyTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return 'Never';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
