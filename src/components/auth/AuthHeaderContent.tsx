
"use client";

import { CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME } from '@/lib/config';

interface AuthHeaderContentProps {
  mode: 'login' | 'signup' | 'resetPassword' | 'awaitingVerification' | 'postGoogleSignup';
  unverifiedUserEmail?: string | null;
  displayNameForPostSignup?: string | null; // New prop
}

export function AuthHeaderContent({ mode, unverifiedUserEmail, displayNameForPostSignup }: AuthHeaderContentProps) {
  let titleText = '';
  let descriptionText = '';

  if (mode === 'postGoogleSignup') {
    titleText = `Welcome, ${displayNameForPostSignup || 'User'}!`;
    descriptionText = `Just a few more details to complete your ${APP_NAME} account setup.`;
  } else if (mode === 'awaitingVerification') {
    titleText = "Verify Your Email";
    descriptionText = `Your email address ${unverifiedUserEmail ? `"${unverifiedUserEmail}"` : ''} is not verified. A verification email has been sent. Please check your inbox (and spam folder).`;
  } else if (mode === 'resetPassword') {
    titleText = `Reset Password for ${APP_NAME}`;
    descriptionText = "Enter your email to receive a password reset link.";
  } else if (mode === 'signup') {
    titleText = `Sign Up for ${APP_NAME}`;
    descriptionText = "Create an account to play, refer friends, and earn rewards! A verification email will be sent to complete your registration.";
  } else { // login
    titleText = `Login to ${APP_NAME}`;
    descriptionText = "Welcome back! Log in to continue.";
  }

  return (
    <>
      <CardTitle className="text-3xl text-center">{titleText}</CardTitle>
      <CardDescription className="text-center">{descriptionText}</CardDescription>
    </>
  );
}
