import { expect, within } from 'storybook/test';
import type { FinancialProvider } from '@/types/api';
import { STORY_AGGREGATOR_PROVIDERS, storyProviderLogoLabel } from './providerPicker';

export function getStoryProviderPickerButton(
  canvas: ReturnType<typeof within>,
  provider: FinancialProvider
) {
  const cardTitle = canvas.getByText(storyProviderLogoLabel(provider), { exact: true });
  const card = cardTitle.closest('.group');
  if (!card) {
    throw new Error(`Provider card not found: ${provider}`);
  }
  return within(card as HTMLElement).getByRole('button', {
    name: /link account|unavailable|connecting|offline|loading/i,
  });
}

export async function expectStoryProviderCardsVisible(canvas: ReturnType<typeof within>) {
  await expect(canvas.getByText('Self-Managed', { exact: true })).toBeVisible();
  for (const provider of STORY_AGGREGATOR_PROVIDERS) {
    await expect(canvas.getByAltText(`${storyProviderLogoLabel(provider)} logo`)).toBeVisible();
  }
}
