
"use client"; // Required for usePathname

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { APP_NAME, ADSENSE_CLIENT_ID } from '@/lib/config';
import { usePathname } from 'next/navigation';
import Link from 'next/link'; // Added for footer links
import Script from 'next/script'; // Import next/script

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showHeaderFooter = !pathname.startsWith('/room/'); // Room page has its own minimal layout

  if (typeof window !== 'undefined') {
    document.title = `${APP_NAME} - Draw and Guess Game`;
  }

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="description" content={`Join the fun in ${APP_NAME}! Draw, guess, and challenge friends in this exciting real-time multiplayer game with AI-powered features.`} />
        <meta name="keywords" content={`drawing game, guess game, multiplayer, online game, Pictionary, AI drawing, sketch game, ${APP_NAME}`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* AdSense Meta Tag */}
        <meta name="google-adsense-account" content={ADSENSE_CLIENT_ID} />
        {/* AdSense Script using next/script */}
        <Script
          id="adsbygoogle-init"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <Providers>
          {showHeaderFooter && <Header />}
          <main className="flex-grow flex flex-col items-center justify-start p-0 md:p-4 w-full"> {/* Changed justify-center to justify-start for pages like contact that might not fill screen */}
            {children}
          </main>
          {showHeaderFooter && (
            <footer className="w-full border-t border-border mt-auto">
              <div className="container mx-auto text-center p-4 text-sm text-muted-foreground">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-x-4 gap-y-2 mb-2">
                  <Link href="/about-us" className="hover:text-primary transition-colors">About Us</Link>
                  <Link href="/contact-us" className="hover:text-primary transition-colors">Contact Us</Link>
                  <Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                  <Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
                </div>
                © {new Date().getFullYear()} {APP_NAME}. Unleash your creativity!
              </div>
            </footer>
          )}
        </Providers>
      </body>
    </html>
  );
}
