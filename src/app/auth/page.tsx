
"use client";

import { useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { Suspense } from 'react';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref'); // Read 'ref' from URL
  const actionFromUrl = searchParams.get('action');
  const redirectQueryParam = searchParams.get('redirect');

  return (
    <AuthForm 
      passedReferralCodeProp={refFromUrl} // Pass 'ref' value to AuthForm
      initialActionProp={actionFromUrl}
      redirectAfterAuth={redirectQueryParam}
      forceSignupFromPath={false} // This page is not /referral/[code]
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
// Added Loader2 to suspense fallback for better UX
import { Loader2 } from 'lucide-react';
