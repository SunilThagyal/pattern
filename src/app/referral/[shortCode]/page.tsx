
import { redirect } from 'next/navigation';
import type { NextPage } from 'next';

interface ReferralRedirectPageProps {
  params: { shortCode: string };
}

// This is a Server Component
const ReferralRedirectPage: NextPage<ReferralRedirectPageProps> = ({ params }) => {
  const { shortCode } = params;

  if (shortCode && typeof shortCode === 'string' && shortCode.trim() !== '') {
    const processedCode = shortCode.trim().toUpperCase();
    // Redirect to the auth page, passing the referral code as 'ref' and forcing signup action
    redirect(`/auth?ref=${processedCode}&action=signup`);
  } else {
    // If no valid code, redirect to auth page without ref, default to signup
    redirect('/auth?action=signup');
  }

  // This return is technically unreachable due to redirect, but good practice for Server Components
  return null; 
};

export default ReferralRedirectPage;
