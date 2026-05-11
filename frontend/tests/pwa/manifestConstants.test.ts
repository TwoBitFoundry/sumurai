import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
  pwaManifestIcons,
  pwaScope,
  pwaStartUrl,
} from '@/pwa/manifestConstants';

describe('manifestConstants', () => {
  it('uses DESIGN baseline dark shell for background', () => {
    expect(PWA_BACKGROUND_COLOR).toBe('#05070d');
  });

  it('uses DESIGN primary for theme chrome', () => {
    expect(PWA_THEME_COLOR).toBe('#0369a1');
  });

  it('scopes SPA root for trailing-slash export', () => {
    expect(pwaStartUrl()).toBe('/');
    expect(pwaScope()).toBe('/');
  });

  it('lists static export icon routes without extension', () => {
    const icons = pwaManifestIcons();
    expect(icons?.map((i) => i.src)).toEqual(['/icon/192', '/icon/512', '/icon/512']);
  });
});
