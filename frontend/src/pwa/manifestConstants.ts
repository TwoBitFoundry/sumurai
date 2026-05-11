import type { Metadata, MetadataRoute } from 'next';
import generatedTokens from '@/ui/generated/tokens';

export const PWA_THEME_COLOR = generatedTokens.color.primary.$value.hex;

export const PWA_BACKGROUND_COLOR = generatedTokens.color['surface-app-shell-dark'].$value.hex;

export const PWA_APP_ICON = {
  w180: '/app-icon-180.webp',
  w192: '/app-icon-192.webp',
  w512: '/app-icon-512.webp',
} as const;

export function pwaStartUrl(): string {
  return '/';
}

export function pwaScope(): string {
  return '/';
}

export function pwaMetadataIcons(): Metadata['icons'] {
  return {
    icon: [
      { url: PWA_APP_ICON.w192, sizes: '192x192', type: 'image/webp' },
      { url: PWA_APP_ICON.w512, sizes: '512x512', type: 'image/webp' },
    ],
    apple: [{ url: PWA_APP_ICON.w180, sizes: '180x180', type: 'image/webp' }],
  };
}

export function pwaManifestIcons(): MetadataRoute.Manifest['icons'] {
  return [
    {
      src: PWA_APP_ICON.w192,
      sizes: '192x192',
      type: 'image/webp',
      purpose: 'any',
    },
    {
      src: PWA_APP_ICON.w512,
      sizes: '512x512',
      type: 'image/webp',
      purpose: 'any',
    },
    {
      src: PWA_APP_ICON.w512,
      sizes: '512x512',
      type: 'image/webp',
      purpose: 'maskable',
    },
  ];
}
