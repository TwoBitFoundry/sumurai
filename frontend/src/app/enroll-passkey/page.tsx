'use client';

import { useRouter } from 'next/navigation';
import { AppProviders } from '@/App';
import { EnrollPasskeyScreen } from '@/features/auth/EnrollPasskeyScreen';

export default function EnrollPasskeyPage() {
  const router = useRouter();

  return (
    <AppProviders>
      <EnrollPasskeyScreen onEnrollmentComplete={() => router.replace('/')} />
    </AppProviders>
  );
}
