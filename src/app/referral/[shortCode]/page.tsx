
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react'; // Ensure lucide-react is installed

export default function ReferralClientRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Wait for router to be available and params to be populated.
    // params might initially be an empty object {}.
    if (!router || !params) {
      console.log("Referral page: router or params not ready yet.");
      return;
    }

    const shortCodeFromPath = params.shortCode as string | undefined;

    if (shortCodeFromPath && typeof shortCodeFromPath === 'string' && shortCodeFromPath.trim() !== '') {
      const processedCode = shortCodeFromPath.trim().toUpperCase();
      const targetUrl = \`/auth?ref=\${encodeURIComponent(processedCode)}&action=signup\`;
      
      // CRITICAL DEBUG LOG: Check what URL is being pushed.
      console.log('[ReferralRedirectPage] Attempting to redirect to:', targetUrl);
      
      router.push(targetUrl);

    } else {
      // This block handles cases where params is resolved but shortCode is missing or invalid.
      // We only want to redirect to default if params is *not* an empty object,
      // signifying that Next.js has attempted to resolve params but found no valid shortCode.
      if (params && Object.keys(params).length > 0 && (!shortCodeFromPath || shortCodeFromPath.trim() === '')) {
        console.warn("[ReferralRedirectPage] shortCode is invalid or missing from resolved params. Redirecting to default auth signup.");
        router.push('/auth?action=signup');
      } else if (params && Object.keys(params).length === 0) {
        // Params is an empty object, possibly still loading.
        console.log("[ReferralRedirectPage] params is empty, waiting for resolution.");
      }
    }
  }, [params, router]); // Depend on the params object and router.

  // Minimal loading UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Processing your referral link...</p>
    </div>
  );
}
