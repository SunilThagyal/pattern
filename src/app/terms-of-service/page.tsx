
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME } from '@/lib/config';
import { FileText, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <FileText className="mr-3 h-8 w-8 text-primary" />
            Terms of Service for {APP_NAME}
          </CardTitle>
          <CardDescription>Last Updated: [Date]</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using
            the {APP_NAME} application (the "Service") operated by [Your Company Name/Your Name]
            ("us", "we", or "our").
          </p>
          <p>
            Your access to and use of the Service is conditioned upon your acceptance of and
            compliance with these Terms. These Terms apply to all visitors, users, and others
            who wish to access or use the Service.
          </p>
          <p>
            By accessing or using the Service you agree to be bound by these Terms. If you
            disagree with any part of the terms then you do not have permission to access
            the Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">1. Accounts</h2>
          <p>
            When you create an account with us, you guarantee that you are above the age of 13 (or
            other applicable age of consent in your jurisdiction) and that the information you provide
            us is accurate, complete, and current at all times. Inaccurate, incomplete, or obsolete
            information may result in the immediate termination of your account on the Service.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account and password,
            including but not limited to the restriction of access to your computer and/or account.
            You agree to accept responsibility for any and all activities or actions that occur
            under your account and/or password.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">2. User Conduct</h2>
          <p>
            You agree not to use the Service to:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Upload, post, email, transmit, or otherwise make available any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</li>
            <li>Impersonate any person or entity.</li>
            <li>Transmit any worms or viruses or any code of a destructive nature.</li>
            <li>Violate any applicable local, state, national, or international law.</li>
          </ul>
          <p>
            We reserve the right to terminate your access to the Service for violating any of the
            prohibited uses.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">3. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding Content provided by users), features,
            and functionality are and will remain the exclusive property of [Your Company Name/Your Name]
            and its licensors. The Service is protected by copyright, trademark, and other laws of
            both [Your Country] and foreign countries.
          </p>
          <p>
            Drawings and content created by users within the game remain the intellectual property of
            their respective creators. However, by using the Service, you grant us a worldwide, non-exclusive,
            royalty-free license to use, reproduce, display, and distribute such content in connection
            with operating and promoting the Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">4. Termination</h2>
          <p>
            We may terminate or suspend your account and bar access to the Service immediately,
            without prior notice or liability, under our sole discretion, for any reason whatsoever
            and without limitation, including but not limited to a breach of the Terms.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">5. Limitation Of Liability</h2>
          <p>
            In no event shall [Your Company Name/Your Name], nor its directors, employees, partners,
            agents, suppliers, or affiliates, be liable for any indirect, incidental, special,
            consequential or punitive damages, including without limitation, loss of profits, data,
            use, goodwill, or other intangible losses, resulting from your access to or use of or
            inability to access or use the Service.
          </p>
          <p className="font-bold mt-2">Placeholder: Add detailed clauses here, including disclaimers of warranties.</p>


          <h2 className="text-xl font-semibold text-foreground pt-4">6. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction],
            without regard to its conflict of law provisions.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">7. Changes</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
            If a revision is material we will provide at least 30 days' notice prior to any new terms
            taking effect. What constitutes a material change will be determined at our sole discretion.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">8. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us through our
            <a href="/contact-us" className="text-primary hover:underline">Contact Us page</a>.
          </p>
          <p className="pt-6 text-xs">
            <strong>Disclaimer:</strong> This is a template Terms of Service and may not be suitable for
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
