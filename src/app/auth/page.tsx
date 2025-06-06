
"use client";

import { useSearchParams } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { Suspense } from 'react';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref');
  const actionFromUrl = searchParams.get('action');

  // Determine redirect path for AuthForm
  const redirectQueryParam = searchParams.get('redirect');

  return (
    <AuthForm 
      passedReferralCodeProp={refFromUrl} 
      initialActionProp={actionFromUrl}
      redirectAfterAuth={redirectQueryParam}
    />
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}

    