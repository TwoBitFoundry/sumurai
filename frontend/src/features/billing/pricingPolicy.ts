export interface TrialAddressErrors {
  countryCode?: string;
  postalCode?: string;
}

export function normalizeTrialCountryCode(value: string): string {
  return value
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 2);
}

export function validateTrialAddress(countryCode: string, postalCode: string): TrialAddressErrors {
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { countryCode: 'Enter a two-letter country code.' };
  }
  if (!postalCode.trim()) {
    return { postalCode: 'Enter a postal code.' };
  }
  return {};
}
