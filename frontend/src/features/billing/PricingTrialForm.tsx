import { type FormEvent, useState } from 'react';
import type { BillingTrialStartRequest } from '@/types/api';
import { Button, FormLabel, Input } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import {
  normalizeTrialCountryCode,
  type TrialAddressErrors,
  validateTrialAddress,
} from './pricingPolicy';

interface PricingTrialFormProps {
  disabled: boolean;
  onStartTrial: (request: BillingTrialStartRequest) => Promise<void>;
}

export function PricingTrialForm({ disabled, onStartTrial }: PricingTrialFormProps) {
  const [countryCode, setCountryCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errors, setErrors] = useState<TrialAddressErrors>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateTrialAddress(countryCode, postalCode);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }
    await onStartTrial({
      country_code: countryCode,
      postal_code: postalCode.trim(),
    });
  };

  return (
    <form className={cn('space-y-4')} onSubmit={(event) => void submit(event)} noValidate>
      <div className={cn('space-y-2')}>
        <FormLabel htmlFor="trial-country-code">Country code</FormLabel>
        <Input
          id="trial-country-code"
          name="country-code"
          autoComplete="country"
          inputMode="text"
          maxLength={2}
          placeholder="US"
          value={countryCode}
          variant={errors.countryCode ? 'invalid' : 'default'}
          aria-invalid={Boolean(errors.countryCode)}
          aria-describedby={errors.countryCode ? 'trial-country-code-error' : undefined}
          disabled={disabled}
          onChange={(event) => {
            setCountryCode(normalizeTrialCountryCode(event.target.value));
            setErrors((current) => ({ ...current, countryCode: undefined }));
          }}
        />
        {errors.countryCode ? (
          <p
            id="trial-country-code-error"
            className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}
          >
            {errors.countryCode}
          </p>
        ) : null}
      </div>

      <div className={cn('space-y-2')}>
        <FormLabel htmlFor="trial-postal-code">Postal code</FormLabel>
        <Input
          id="trial-postal-code"
          name="postal-code"
          autoComplete="postal-code"
          placeholder="78701"
          value={postalCode}
          variant={errors.postalCode ? 'invalid' : 'default'}
          aria-invalid={Boolean(errors.postalCode)}
          aria-describedby={errors.postalCode ? 'trial-postal-code-error' : undefined}
          disabled={disabled}
          onChange={(event) => {
            setPostalCode(event.target.value);
            setErrors((current) => ({ ...current, postalCode: undefined }));
          }}
        />
        {errors.postalCode ? (
          <p
            id="trial-postal-code-error"
            className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}
          >
            {errors.postalCode}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        className={cn('w-full')}
        disabled={disabled}
      >
        Start free trial
      </Button>
    </form>
  );
}
