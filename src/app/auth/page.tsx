
"use client";

import { useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm'; // Updated path
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref');
  const actionFromUrl = searchParams.get('action');
  const redirectQueryParam = searchParams.get('redirect');

  return (
    <AuthForm 
      passedReferralCodeProp={refFromUrl}
      initialActionProp={actionFromUrl}
      redirectAfterAuth={redirectQueryParam}
      forceSignupFromPath={false}
    />
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin"/>Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
