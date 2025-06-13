
"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmailPasswordFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  emailError: string;
  password?: string;
  onPasswordChange?: (value: string) => void;
  onPasswordBlur?: () => void;
  passwordError?: string;
  isLoading: boolean;
  showPasswordInput?: boolean;
}

export function EmailPasswordFields({
  email, onEmailChange, onEmailBlur, emailError,
  password, onPasswordChange, onPasswordBlur, passwordError,
  isLoading, showPasswordInput = true,
}: EmailPasswordFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="email_auth_form_component">Email <span className="text-destructive">*</span></Label>
        <Input
          id="email_auth_form_component"
          name="email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          placeholder="you@example.com"
          required
          className="text-base"
          disabled={isLoading}
        />
        {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
      </div>

      {showPasswordInput && onPasswordChange && onPasswordBlur && (
        <div className="space-y-1">
          <Label htmlFor="password_auth_form_component">Password <span className="text-destructive">*</span></Label>
          <Input
            id="password_auth_form_component"
            name="password"
            type="password"
            value={password || ''}
            onChange={(e) => onPasswordChange(e.target.value)}
            onBlur={onPasswordBlur}
            placeholder="••••••••"
            required
            className="text-base"
            disabled={isLoading}
          />
          {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
        </div>
      )}
    </>
  );
}
