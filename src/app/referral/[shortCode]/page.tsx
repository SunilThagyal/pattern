
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
    // Construct the URL for redirection with query parameters
    const redirectUrl = `/auth?ref=${processedCode}&action=signup`;
    redirect(redirectUrl);
  } else {
    // If no valid code, redirect to auth page default to signup
    redirect('/auth?action=signup');
  }

  // This return is technically unreachable due to redirect, but good practice for Server Components
  return null; 
};

export default ReferralRedirectPage;
