
"use client";

import AuthForm from '@/components/auth/AuthForm';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ReferralPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shortCode = params.shortCode as string;

  // Determine redirect path for AuthForm if any other query params are present
  const redirectQueryParam = searchParams.get('redirect');

  return (
    <AuthForm 
      passedReferralCodeProp={shortCode?.toUpperCase()} 
      forceSignupFromPath={true} 
      redirectAfterAuth={redirectQueryParam}
    />
  );
}

export default function ReferralPage() {
  // Using Suspense because useParams and useSearchParams are client hooks
  // and this page is now rendering a client component AuthForm directly.
  return (
    <Suspense fallback={<div>Loading referral...</div>}>
      <ReferralPageContent />
    </Suspense>
  );
}

    