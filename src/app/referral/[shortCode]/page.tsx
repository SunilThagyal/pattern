
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReferralRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // params.shortCode can be a string or string[] or undefined.
    // We expect a single string.
    const shortCodeFromParams = Array.isArray(params.shortCode) ? params.shortCode[0] : params.shortCode;

    if (typeof shortCodeFromParams === 'string' && shortCodeFromParams.trim() !== '') {
      const LSTORAGE_PENDING_REFERRAL_KEY = "drawlyPendingReferralCode";
      const codeToProcess = shortCodeFromParams.trim().toUpperCase();

      // Attempt to set localStorage only if it's not already set (first link wins)
      if (!localStorage.getItem(LSTORAGE_PENDING_REFERRAL_KEY)) {
        localStorage.setItem(LSTORAGE_PENDING_REFERRAL_KEY, codeToProcess);
      }
      
      // CRITICAL: Ensure redirect URL includes the 'ref' parameter
      const redirectUrl = `/auth?ref=${codeToProcess}&action=signup`;
      router.replace(redirectUrl);

    } else if (params.shortCode !== undefined) {
      // This case means params.shortCode was resolved but was not a valid non-empty string.
      // Redirect to signup without any referral code.
      router.replace('/auth?action=signup');
    }
    // If params.shortCode is initially undefined, this effect will re-run when Next.js fully populates params.
    // No explicit 'else' needed here as the conditions cover resolved states.
  }, [params, router]); // `params` is a key dependency here to re-run when shortCode is resolved.

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary">Referral Processing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-lg text-muted-foreground">Processing your referral link...</p>
          <p className="text-sm text-muted-foreground mt-2">You will be redirected shortly.</p>
        </CardContent>
      </Card>
    </div>
  );
}
