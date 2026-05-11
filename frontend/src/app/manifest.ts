import type { MetadataRoute } from 'next';
import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
  pwaManifestIcons,
  pwaScope,
  pwaStartUrl,
} from '@/pwa/manifestConstants';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sumurai',
    short_name: 'Sumurai',
    description: 'Personal finance with provider-aware onboarding',
    start_url: pwaStartUrl(),
    scope: pwaScope(),
    display: 'standalone',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    icons: pwaManifestIcons(),
  };
}
