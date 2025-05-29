
"use client"; // Required for usePathname

import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed to Inter as per globals.css
import './globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { APP_NAME } from '@/lib/config';
import { usePathname } from 'next/navigation'; // Import usePathname

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// Metadata needs to be defined outside if it's dynamic or if RootLayout becomes a client component.
// For now, assuming static metadata is acceptable. If dynamic metadata is needed based on path,
// it would require a different approach (e.g. generateMetadata function in page.tsx).
// export const metadata: Metadata = { // This static export doesn't work well with "use client"
//   title: `${APP_NAME} - Draw and Guess Game`,
//   description: `Join the fun in ${APP_NAME}! Draw design patterns and let your friends guess. A real-time multiplayer game.`,
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showHeader = !pathname.startsWith('/room/');

  // It's better to set the title dynamically in client components if metadata object is an issue
  if (typeof window !== 'undefined') {
    document.title = `${APP_NAME} - Draw and Guess Game`;
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <Providers>
          {showHeader && <Header />}
          <main className="flex-grow flex flex-col items-center justify-center p-0 md:p-0">
            {/* Removed default padding to allow game room to go full width/height */}
            {children}
          </main>
          {/* Footer can also be made conditional if needed */}
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
