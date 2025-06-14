
"use client";

import type { ReactNode } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

interface AuthCardProps {
  header: ReactNode;
  content: ReactNode;
  footer?: ReactNode; // Optional footer content from main form
  showDefaultFooterLinks?: boolean; // To show default login/signup toggle
  currentAuthActionState?: 'default' | 'awaitingVerification' | 'resetPassword';
}

export function AuthCard({ header, content, footer, showDefaultFooterLinks = true, currentAuthActionState }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        {header}
      </CardHeader>
      <CardContent className="space-y-3">
        {content}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-4">
        {footer}
        {showDefaultFooterLinks && currentAuthActionState !== 'awaitingVerification' && (
             <Link href="/" className="text-sm text-muted-foreground hover:text-primary mt-1">
                Maybe later? Back to Home
            </Link>
        )}
      </CardFooter>
    </Card>
  );
}
