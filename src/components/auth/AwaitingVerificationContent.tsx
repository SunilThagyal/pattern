
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Mail, LogOut } from 'lucide-react';
import Link from 'next/link';
import { AuthError } from './AuthError';

interface AwaitingVerificationContentProps {
  onResendVerificationEmail: () => void;
  isResendingVerification: boolean;
  newEmailForVerification: string;
  onNewEmailChange: (value: string) => void;
  onUpdateEmail: () => void;
  isUpdatingEmail: boolean;
  onLogout: () => void;
  errorMessage: string | null; // Specific error for this view
}

export function AwaitingVerificationContent({
  onResendVerificationEmail, isResendingVerification,
  newEmailForVerification, onNewEmailChange, onUpdateEmail, isUpdatingEmail,
  onLogout, errorMessage
}: AwaitingVerificationContentProps) {
  const isProcessing = isResendingVerification || isUpdatingEmail;

  return (
    <div className="space-y-4">
      <AuthError message={errorMessage} />
      <Button onClick={onResendVerificationEmail} className="w-full" disabled={isProcessing}>
        {isResendingVerification ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
        {isResendingVerification ? 'Sending...' : 'Resend Verification Email'}
      </Button>

      <div className="space-y-2 pt-4 border-t">
        <Label htmlFor="newEmailForVerification_awaiting" className="text-md">Incorrect email? Update it here:</Label>
        <Input
          id="newEmailForVerification_awaiting"
          type="email"
          placeholder="Enter new email address"
          value={newEmailForVerification}
          onChange={(e) => onNewEmailChange(e.target.value)}
          disabled={isProcessing}
        />
        <Button onClick={onUpdateEmail} variant="outline" className="w-full" disabled={isProcessing || !newEmailForVerification.trim()}>
          {isUpdatingEmail ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
          {isUpdatingEmail ? 'Updating...' : 'Update Email & Resend Verification'}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2 mt-2">
        <Button variant="link" onClick={onLogout} disabled={isProcessing}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
         <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            Back to Home
        </Link>
      </div>
    </div>
  );
}
