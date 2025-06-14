
"use client";

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { EmailPasswordFields } from './EmailPasswordFields';
import { AuthError } from './AuthError';

interface ResetPasswordContentProps {
  email: string;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  emailError: string;
  onSubmit: (e: FormEvent) => void; // This will call handleForgotPassword
  isLoading: boolean;
  onBackToLogin: () => void;
  error: string | null;
}

export function ResetPasswordContent({
  email, onEmailChange, onEmailBlur, emailError,
  onSubmit, isLoading, onBackToLogin, error
}: ResetPasswordContentProps) {
  return (
    <form onSubmit={onSubmit} id="reset-password-form" className="space-y-3">
      <AuthError message={error} />
      <EmailPasswordFields
        email={email}
        onEmailChange={onEmailChange}
        onEmailBlur={onEmailBlur}
        emailError={emailError}
        isLoading={isLoading}
        showPasswordInput={false} // Only need email for password reset
      />
      <Button type="submit" className="w-full text-base py-5" disabled={isLoading || !email.trim() || !!emailError}>
        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
        {isLoading ? 'Sending...' : 'Send Reset Email'}
      </Button>
      <Button
        type="button"
        variant="link"
        className="mt-1 w-full"
        onClick={onBackToLogin}
        disabled={isLoading}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
      </Button>
    </form>
  );
}
