
import { redirect } from 'next/navigation';

// This is now a Server Component.
// It directly redirects to the /auth page with the referral code in the 'ref' query parameter.

interface ReferralRedirectPageProps {
  params: { shortCode: string };
}

export default function ReferralRedirectPage({ params }: ReferralRedirectPageProps) {
  const code = params.shortCode;

  if (code && typeof code === 'string' && code.trim() !== '') {
    const upperCaseCode = code.trim().toUpperCase();
    // Redirect to /auth, ensuring 'ref' query parameter is set, and action is signup.
    redirect(`/auth?ref=${upperCaseCode}&action=signup`);
  } else {
    // If no valid code, redirect to auth for signup without a ref code.
    redirect(`/auth?action=signup`);
  }
  // Server components that redirect don't return JSX.
  // The loading UI previously here is not needed as redirect is immediate.
}
