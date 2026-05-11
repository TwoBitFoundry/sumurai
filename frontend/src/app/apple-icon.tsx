import { ImageResponse } from 'next/og';
import generatedTokens from '@/ui/generated/tokens';

export const dynamic = 'force-static';

export const runtime = 'nodejs';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  const shellDark = generatedTokens.color['surface-app-shell-dark'].$value.hex;
  const accentSky = generatedTokens.color['brand-sky-dark'].$value.hex;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: shellDark,
        color: accentSky,
        fontSize: 100,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      S
    </div>,
    {
      width: size.width,
      height: size.height,
    }
  );
}
