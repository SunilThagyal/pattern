
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

    if (shortCodeFromParams && typeof shortCodeFromParams === 'string' && shortCodeFromParams.trim() !== '') {
      const LSTORAGE_PENDING_REFERRAL_KEY = "drawlyPendingReferralCode";
      const existingPendingCode = localStorage.getItem(LSTORAGE_PENDING_REFERRAL_KEY);

      if (!existingPendingCode) {
        localStorage.setItem(LSTORAGE_PENDING_REFERRAL_KEY, shortCodeFromParams.trim().toUpperCase());
      }
      // Always redirect to auth page, which will pick up the code from localStorage
      // Optionally, add action=signup to ensure it defaults to signup mode
      router.replace(`/auth?action=signup`);
    } else if (params.shortCode !== undefined && params.shortCode !== null) {
      // shortCode resolved but was empty or invalid, redirect without referral
      router.replace('/auth');
    }
    // If params.shortCode is undefined/null, effect does nothing, waits for params to update.
  }, [params, router]);

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
