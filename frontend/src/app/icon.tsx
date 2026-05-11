import { ImageResponse } from 'next/og';
import generatedTokens from '@/ui/generated/tokens';

export const dynamic = 'force-static';

export const runtime = 'nodejs';

export async function generateImageMetadata() {
  return [
    {
      contentType: 'image/png',
      size: { width: 192, height: 192 },
      id: '192',
    },
    {
      contentType: 'image/png',
      size: { width: 512, height: 512 },
      id: '512',
    },
  ];
}

type IconProps = { id?: string };

export default function Icon({ id }: IconProps) {
  const dimension = id === '512' ? 512 : 192;
  const fontSize = id === '512' ? 280 : 96;
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
        fontSize,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      S
    </div>,
    {
      width: dimension,
      height: dimension,
    }
  );
}
