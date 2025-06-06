
import { redirect } from 'next/navigation';

// This is a Server Component and should not contain client-side hooks or logic.

export default function ReferralRedirectPage({ params }: { params: { shortCode: string } }) {
  const shortCodeParam = params.shortCode;

  if (shortCodeParam && typeof shortCodeParam === 'string' && shortCodeParam.trim() !== '') {
    const processedCode = shortCodeParam.trim().toUpperCase();
    // Forcefully construct the redirect URL with the ref query parameter
    const targetUrl = `/auth?ref=${encodeURIComponent(processedCode)}&action=signup`;
    redirect(targetUrl);
  } else {
    // Fallback if no valid shortCode is provided, still guide to signup
    redirect('/auth?action=signup');
  }

  // The redirect function throws an error, so this part is not reached.
  // Returning null is a convention for components that only redirect.
  return null;
}
