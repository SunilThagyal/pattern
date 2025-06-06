
import { redirect } from 'next/navigation';

// This is a Server Component.
// Its sole purpose is to extract the shortCode and redirect to the /auth page
// with the shortCode as a 'ref' query parameter.

interface ReferralRedirectPageProps {
  params: { shortCode: string };
}

export default function ReferralRedirectPage({ params }: ReferralRedirectPageProps) {
  const code = params.shortCode;

  if (code && typeof code === 'string' && code.trim().length > 0) {
    // Force uppercase and trim, then redirect
    // Crucially, ensure 'ref' query parameter is set and action=signup is included
    const processedCode = code.trim().toUpperCase();
    redirect(`/auth?ref=${processedCode}&action=signup`);
  } else {
    // Fallback: If no valid shortCode is provided (e.g., URL was /referral/),
    // redirect to auth page for regular signup.
    redirect('/auth?action=signup');
  }
  // Server components that redirect typically don't return JSX.
  // The redirect function handles the response.
}
