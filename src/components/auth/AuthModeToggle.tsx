
"use client";

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface AuthModeToggleProps {
  authActionState: 'default' | 'resetPassword';
  isSigningUp: boolean;
  onToggleMode: (mode: 'login' | 'signup' | 'resetPassword') => void;
  isLoading: boolean;
}

export function AuthModeToggle({ authActionState, isSigningUp, onToggleMode, isLoading }: AuthModeToggleProps) {
  if (authActionState === 'resetPassword') {
    return (
      <Button
        type="button"
        variant="link"
        className="mt-1"
        onClick={() => onToggleMode('login')}
        disabled={isLoading}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="link"
      className="mt-1"
      onClick={() => onToggleMode(isSigningUp ? 'login' : 'signup')}
      disabled={isLoading}
    >
      {isSigningUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
    </Button>
  );
}
