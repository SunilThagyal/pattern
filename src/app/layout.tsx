
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed to Inter as per globals.css
import './globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { APP_NAME } from '@/lib/config';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: `${APP_NAME} - Draw and Guess Game`,
  description: `Join the fun in ${APP_NAME}! Draw design patterns and let your friends guess. A real-time multiplayer game.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <Providers>
          <Header />
          <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
            {children}
          </main>
          <footer className="text-center p-4 text-sm text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. Unleash your creativity!
          </footer>
        </Providers>
      </body>
    </html>
  );
}
