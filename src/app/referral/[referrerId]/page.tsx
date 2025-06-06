"use client";

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; 

// Make sure this file is located at: src/app/referral/[shortCode]/page.tsx

export default function ReferralRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const shortCode = params.shortCode as string; 

  useEffect(() => {
    if (shortCode) {
      const existingQuery = new URLSearchParams(searchParams.toString());

      // ✅ Use 'ref' to match what's used in /auth page
      existingQuery.set('ref', shortCode);
      existingQuery.set('action', 'signup'); 

      router.replace(`/auth?${existingQuery.toString()}`);
    } else {
      router.replace('/auth');
    }
  }, [shortCode, router, searchParams]);

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