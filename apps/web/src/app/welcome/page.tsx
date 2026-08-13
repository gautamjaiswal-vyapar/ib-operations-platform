'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceLoader } from '@/components/auth/workspace-loader';
import { useAuth } from '@/components/auth/auth-provider';

const waitSeconds = 5;
export default function WelcomePage() {
  const auth = useAuth();
  const router = useRouter();
  const [countdown, setCountdown] = useState(waitSeconds);
  useEffect(() => { if (auth.loading) return; if (!auth.session) { router.replace('/login'); return; } router.prefetch('/dashboard'); const interval = window.setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000); const redirect = window.setTimeout(() => router.replace('/dashboard'), waitSeconds * 1000); return () => { window.clearInterval(interval); window.clearTimeout(redirect); }; }, [auth.loading, auth.session, router]);
  if (auth.loading) return <WorkspaceLoader verifying />;
  return <WorkspaceLoader user={auth.session} countdown={countdown} onContinue={() => router.replace('/dashboard')} />;
}
