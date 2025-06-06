
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Removed useSearchParams as it's not directly used for constructing the new URL here
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReferralRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // The 'params' object from useParams() might be empty on the initial render
    // and then populated by Next.js once the dynamic segments are resolved.
    // This useEffect hook will re-run when the 'params' object instance changes.
    const shortCodeFromParams = params.shortCode as string;

    if (shortCodeFromParams && typeof shortCodeFromParams === 'string' && shortCodeFromParams.trim() !== '') {
      // If we have a valid shortCode, construct the redirect URL to the auth page.
      const query = new URLSearchParams();
      query.set('referralCode', shortCodeFromParams.trim().toUpperCase());
      query.set('action', 'signup'); // Force signup mode for referral links
      router.replace(`/auth?${query.toString()}`);
    } else if (params.shortCode !== undefined && params.shortCode !== null) {
        // This case handles when params.shortCode *has* been resolved by Next.js,
        // but it turned out to be an empty string or some other invalid value.
        // We fall back to redirecting to the auth page without any referral code.
        router.replace('/auth');
    }
    // If params.shortCode is still undefined or null (meaning Next.js hasn't resolved it yet),
    // this effect does nothing in the current execution. It will run again when 'params' updates.
  }, [params, router]); // The key change is depending on the entire 'params' object.

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
