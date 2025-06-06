
import { redirect } from 'next/navigation';
import { type NextPage } from 'next';

interface ReferralRedirectPageProps {
  params: {
    shortCode?: string;
  };
}

// This is a Server Component
const ReferralRedirectPage: NextPage<ReferralRedirectPageProps> = ({ params }) => {
  const shortCodeParam = params.shortCode;

  if (shortCodeParam && typeof shortCodeParam === 'string' && shortCodeParam.trim() !== '') {
    const processedCode = shortCodeParam.trim().toUpperCase();
    const targetUrl = `/auth?ref=${encodeURIComponent(processedCode)}&action=signup`;
    console.log(`[Server Component /referral/${shortCodeParam}] Redirecting to: ${targetUrl}`);
    redirect(targetUrl);
  } else {
    // Fallback if shortCode is missing or invalid
    console.log("[Server Component /referral/...] Invalid or missing shortCode, redirecting to default auth signup.");
    redirect('/auth?action=signup');
  }

  // This part should ideally not be reached due to the redirect.
  // However, to satisfy Next.js build requirements for page components,
  // we return a minimal JSX structure.
  return null;
};

export default ReferralRedirectPage;
