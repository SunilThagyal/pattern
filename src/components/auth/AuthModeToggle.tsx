
"use client";

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface AuthModeToggleProps {
  isSigningUp: boolean;
  onToggleMode: () => void; // Simplified: just toggles between login/signup
  isLoading: boolean;
}

export function AuthModeToggle({ isSigningUp, onToggleMode, isLoading }: AuthModeToggleProps) {
  return (
    <Button
      type="button"
      variant="link"
      className="mt-1"
      onClick={onToggleMode}
      disabled={isLoading}
    >
      {isSigningUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
    </Button>
  );
}

