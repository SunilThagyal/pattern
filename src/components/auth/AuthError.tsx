
"use client";

import { AlertCircle } from 'lucide-react';

interface AuthErrorProps {
  message: string | null;
}

export function AuthError({ message }: AuthErrorProps) {
  if (!message) return null;

  return (
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive">
      <AlertCircle className="inline-block mr-1 h-4 w-4" /> {message}
    </div>
  );
}
