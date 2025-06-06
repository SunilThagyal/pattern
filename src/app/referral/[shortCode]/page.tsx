
'use client'; // Explicitly a Client Component

import { useEffect, useState } from 'react';
import { useParams, useRouter }  from 'next/navigation'; // Correct imports for App Router
import { Loader2 } from 'lucide-react';

export default function ReferralRedirectPage() {
  const router = useRouter();
  const params = useParams(); // params can be an empty object initially

  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    setStatus('Reading referral code from URL parameters...');
    console.log('[ReferralRedirectPage CLIENT] useEffect triggered. Current params:', JSON.stringify(params));

    // params can be null or an empty object initially, or params.shortCode might be an array
    const shortCodeFromPath = params?.shortCode ? (Array.isArray(params.shortCode) ? params.shortCode[0] : params.shortCode) : null;

    if (shortCodeFromPath && typeof shortCodeFromPath === 'string' && shortCodeFromPath.trim() !== '') {
      const processedCode = shortCodeFromPath.trim().toUpperCase();
      const targetUrl = `/auth?ref=${encodeURIComponent(processedCode)}&action=signup`;
      
      console.log(`[ReferralRedirectPage CLIENT] Extracted shortCode: '${shortCodeFromPath}'`);
      console.log(`[ReferralRedirectPage CLIENT] Processed code: '${processedCode}'`);
      console.log(`[ReferralRedirectPage CLIENT] Target URL for redirect: '${targetUrl}'`);
      setStatus(`Found referral code '${processedCode}'. Redirecting...`);
      
      // Perform the client-side redirect
      router.push(targetUrl);
    } else {
      if (params && Object.keys(params).length > 0 && !shortCodeFromPath) {
        // This means params were loaded, but shortCode was missing or invalid
        console.warn('[ReferralRedirectPage CLIENT] shortCode is missing or invalid in params:', JSON.stringify(params));
        setStatus('Referral code in URL is invalid. Redirecting to default signup...');
        router.push('/auth?action=signup');
      } else if (!params || Object.keys(params).length === 0) {
        // Params not yet available, this might happen on initial render before hydration is complete
        console.log('[ReferralRedirectPage CLIENT] Params not yet available or empty. Waiting for hydration or subsequent effect run.');
        setStatus('Waiting for referral code from URL...');
        // No redirect here, useEffect will re-run when params are available
      } else {
        // Fallback for any other unexpected case
        console.error('[ReferralRedirectPage CLIENT] Unknown issue with referral code processing. Current Params:', JSON.stringify(params));
        setStatus('Error processing referral code. Redirecting to default signup...');
        router.push('/auth?action=signup');
      }
    }
  // Dependency array: re-run if `params` object itself changes (Next.js might repopulate it) or if `router` instance changes (unlikely but good practice).
  }, [params, router]);


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="bg-background p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Processing Your Referral</h1>
        <p className="text-sm text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-4">
          If you are not redirected automatically, please <a href="/auth?action=signup" className="underline text-primary">click here to sign up</a>.
        </p>
      </div>
    </div>
  );
}
