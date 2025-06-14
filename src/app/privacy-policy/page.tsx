import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME } from '@/lib/config';
import { ShieldCheck, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <ShieldCheck className="mr-3 h-8 w-8 text-primary" />
            Privacy Policy for {APP_NAME}
          </CardTitle>
          <CardDescription>Last Updated: [06/14/2025]</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            Welcome to {APP_NAME}! This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you use our application. Please read this
            privacy policy carefully. If you do not agree with the terms of this privacy policy,
            please do not access the application.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">1. Information We Collect</h2>
          <p>
            We may collect information about you in a variety of ways. The information we may
            collect via the Application depends on the content and materials you use, and includes:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>
              <strong>Personal Data:</strong> Personally identifiable information, such as your name,
              email address, and demographic information, that you voluntarily give to us when you
              register with the Application or when you choose to participate in various activities
              related to the Application, such as online chat, message boards, or the referral program.
            </li>
            <li>
              <strong>Gameplay Data:</strong> We collect data related to your gameplay, such as scores,
              room IDs (if playing anonymously), drawings, guesses, interactions with AI features, and
              participation in games with more than two players through the referral program.
            </li>
            <li>
              <strong>Usage Data:</strong> Information automatically collected when you access the Application,
              such as your IP address, browser type, operating system, access times, and the pages you
              have viewed directly before and after accessing the Application. (This is standard for most web services).
            </li>
            <li>
              <strong>Reward and Withdrawal Data:</strong> Information related to rewards earned through gameplay
              or referrals, including withdrawal requests and associated financial details, to process and verify
              reward payouts.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">2. Use of Your Information</h2>
          <p>
            Having accurate information about you permits us to provide you with a smooth, efficient,
            and customized experience. Specifically, we may use information collected about you via
            the Application to:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Create and manage your account.</li>
            <li>Enable user-to-user communications.</li>
            <li>Administer game sessions and provide game functionalities.</li>
            <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
            <li>Notify you of updates to the Application.</li>
            <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
            <li>Administer the referral program, including tracking referrals and distributing rewards.</li>
            <li>Process and verify withdrawal requests for earned rewards.</li>
            <li>Deliver targeted advertisements through third-party services like Google Ads.</li>
            <li>Analyze user behavior and application performance using Google Analytics.</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">3. Disclosure of Your Information</h2>
          <p>
            We may share information we have collected about you in certain situations. Your information
            may be disclosed as follows:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>
              <strong>Third-Party Service Providers:</strong> We may share your information with third-party
              service providers, such as Google Ads and Google Analytics, to deliver advertisements and analyze
              usage data. These providers may collect and process your data in accordance with their own privacy policies.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your information if required to do so by law
              or in response to valid requests by public authorities (e.g., a court or government agency).
            </li>
            <li>
              <strong>Fraud Prevention:</strong> We may share your information to investigate or prevent fraudulent
              activities, cheating, unauthorized access, or other violations of our Terms of Service, including
              issues related to the referral program or reward withdrawals.
            </li>
            <li>
              <strong>Business Transfers:</strong> We may share or transfer your information in connection with,
              or during negotiations of, any merger, sale of company assets, financing, or acquisition of all
              or a portion of our business to another company.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">4. Third-Party Services</h2>
          <p>
            The Application uses Google Ads to serve advertisements and Google Analytics to analyze usage data.
            These third-party services may collect information such as your IP address, browser type, and
            interaction with the Application to provide targeted ads and usage insights. By using the Application,
            you consent to the collection and use of your data by these services in accordance with their respective
            privacy policies. We are not responsible for the practices of these third-party services.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">5. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your
            personal information. While we have taken reasonable steps to secure the personal
            information you provide to us, please be aware that despite our efforts, no security
            measures are perfect or impenetrable, and no method of data transmission can be
            guaranteed against any interception or other type of misuse. In cases of detected cheating
            or unauthorized access, we may suspend accounts or block withdrawal requests to protect the integrity
            of the Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">6. Policy for Children</h2>
          <p>
            We do not knowingly solicit information from or market to children under the age of 13.
            If you become aware of any data we have collected from children under age 13, please
            contact us using the contact information provided below.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">7. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new Privacy Policy on this page. You are advised to review this Privacy
            Policy periodically for any changes.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">8. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please contact us through
            our <a href="/contact-us" className="text-primary hover:underline">Contact Us page</a> or at:
            suviplay@devifyo.com
          </p>
          <p className="pt-6 text-xs">
            <strong>Disclaimer:</strong> This is a template Privacy Policy and may not be suitable for
            all jurisdictions or applications. You should consult with a legal professional to ensure
            compliance with all applicable laws and regulations.
          </p>
          <div className="mt-8 text-center">
            <Link href="/" passHref>
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Back to Game Lobby
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}