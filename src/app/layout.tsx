
"use client"; // Required for usePathname

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { APP_NAME } from '@/lib/config';
import { usePathname } from 'next/navigation';

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
  const showHeader = !pathname.startsWith('/room/');

  if (typeof window !== 'undefined') {
    document.title = `${APP_NAME} - Draw and Guess Game`;
  }

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="description" content={`Join the fun in ${APP_NAME}! Draw, guess, and challenge friends in this exciting real-time multiplayer game with AI-powered features.`} />
        <meta name="keywords" content="drawing game, guess game, multiplayer, online game, Pictionary, AI drawing, sketch game, Drawly" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" /> {/* Recommended way for favicon */}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <Providers>
          {showHeader && <Header />}
          <main className="flex-grow flex flex-col items-center justify-center p-0 md:p-0">
            {children}
          </main>
          {showHeader && (
            <footer className="text-center p-4 text-sm text-muted-foreground">
              © {new Date().getFullYear()} {APP_NAME}. Unleash your creativity!
            </footer>
          )}
        </Providers>
      </body>
    </html>
  );
}

