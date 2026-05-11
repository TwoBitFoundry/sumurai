import type { MetadataRoute } from 'next';
import generatedTokens from '@/ui/generated/tokens';

export const PWA_THEME_COLOR = generatedTokens.color.primary.$value.hex;

export const PWA_BACKGROUND_COLOR = generatedTokens.color['surface-app-shell-dark'].$value.hex;

export function pwaStartUrl(): string {
  return '/';
}

export function pwaScope(): string {
  return '/';
}

export function pwaManifestIcons(): MetadataRoute.Manifest['icons'] {
  return [
    {
      src: '/icon/192',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon/512',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon/512',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ];
}
