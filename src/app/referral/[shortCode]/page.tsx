
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReferralRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const shortCodeFromParams = params.shortCode as string;

    // Only proceed if shortCodeFromParams is a valid, non-empty string
    if (typeof shortCodeFromParams === 'string' && shortCodeFromParams.trim() !== '') {
      const LSTORAGE_PENDING_REFERRAL_KEY = "drawlyPendingReferralCode";
      const codeToStoreAndRedirect = shortCodeFromParams.trim().toUpperCase();

      // Store in localStorage if not already present (first link clicked sticks)
      if (!localStorage.getItem(LSTORAGE_PENDING_REFERRAL_KEY)) {
        localStorage.setItem(LSTORAGE_PENDING_REFERRAL_KEY, codeToStoreAndRedirect);
      }
      
      // IMPORTANT: Redirect WITH the ref parameter and action=signup
      // This ensures /auth page can pick it up if localStorage somehow fails or for direct /auth?ref= links.
      router.replace(`/auth?ref=${codeToStoreAndRedirect}&action=signup`);

    } else if (params.shortCode !== undefined) {
      // This means params.shortCode was defined but was empty or invalid after trimming.
      // Redirect to signup without any referral code.
      router.replace('/auth?action=signup');
    }
    // If params.shortCode is initially undefined, the effect will re-run when Next.js populates it.
    // No 'else' is needed because we only act when params.shortCode is defined.
  }, [params, router]); // `params` is a crucial dependency here

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
