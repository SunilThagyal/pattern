
import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { APP_NAME } from '@/lib/config';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="bg-background border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto py-4 px-4 md:px-6 flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{APP_NAME} - Admin Panel</h1>
        </div>
      </header>
      <main className="flex-grow container mx-auto py-6 px-4 md:px-6">
        {children}
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t border-border">
        Admin Panel Prototype. Access should be restricted in a production environment.
      </footer>
    </div>
  );
}
