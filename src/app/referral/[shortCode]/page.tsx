
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ReferralClientRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Ensure params are available and router is ready.
    // params can sometimes be an empty object on first render.
    if (router && params && params.shortCode) {
      const shortCodeFromPath = params.shortCode as string;

      if (typeof shortCodeFromPath === 'string' && shortCodeFromPath.trim() !== '') {
        const processedCode = shortCodeFromPath.trim().toUpperCase();
        const targetUrl = `/auth?ref=${encodeURIComponent(processedCode)}&action=signup`;
        // Perform client-side redirect
        router.replace(targetUrl);
      } else {
        // Fallback if shortCode is invalid or empty after trim
        router.replace('/auth?action=signup');
      }
    } else if (router && params && !params.shortCode) {
        // Handle case where shortCode might be missing from params, though it should be there for this route
        console.warn("Referral page: shortCode missing from params, redirecting to default auth.");
        router.replace('/auth?action=signup');
    }
  }, [params, router]); // Effect dependencies

  // Render a loading state while the redirect is being processed client-side.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <p className="text-lg text-muted-foreground">Processing your referral link...</p>
      <p className="text-sm text-muted-foreground mt-2">You will be redirected shortly.</p>
    </div>
  );
}
