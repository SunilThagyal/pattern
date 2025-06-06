
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReferralClientRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Ensure params and router are available.
    // params can be an empty object on initial render, before Next.js hydration completes for dynamic segments.
    if (router && params && params.shortCode) {
      const shortCodeFromPath = params.shortCode as string;

      if (typeof shortCodeFromPath === 'string' && shortCodeFromPath.trim() !== '') {
        const processedCode = shortCodeFromPath.trim().toUpperCase();
        // Construct the target URL with the ref query parameter
        const targetUrl = `/auth?ref=${encodeURIComponent(processedCode)}&action=signup`;
        
        // Perform client-side redirect
        router.push(targetUrl);
      } else {
        // Fallback if shortCode is invalid or empty after trim
        console.warn("Referral page: shortCode is invalid. Redirecting to default auth signup.");
        router.push('/auth?action=signup');
      }
    } else if (router && params && !params.shortCode && Object.keys(params).length > 0) {
        // This condition handles the case where params object is available but shortCode is missing.
        console.warn("Referral page: shortCode missing from params. Redirecting to default auth signup.");
        router.push('/auth?action=signup');
    }
    // Adding `params.shortCode` to the dependency array ensures the effect re-runs if it resolves later.
  }, [params, router, params.shortCode]); 

  // Render a loading state while the redirect is being processed client-side.
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
