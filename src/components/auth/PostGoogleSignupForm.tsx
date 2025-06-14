
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, AlertCircle, Save } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { AuthError } from './AuthError'; // For displaying form-specific errors

interface PostGoogleSignupFormProps {
  initialDisplayName: string;
  passedReferralCodeProp?: string | null; // To prefill referral code
  onSubmit: (formData: {
    country: 'India' | 'Other';
    gender: UserProfile['gender'] | '';
    countryCode: string;
    phoneNumber: string;
    referralCode: string;
  }) => Promise<void>;
  isLoading: boolean;
  referralProgramEnabled: boolean;
  isLoadingPlatformSettings: boolean;
  onCancel: () => void; // To go back if user cancels this step
}

export function PostGoogleSignupForm({
  initialDisplayName,
  passedReferralCodeProp,
  onSubmit,
  isLoading,
  referralProgramEnabled,
  isLoadingPlatformSettings,
  onCancel
}: PostGoogleSignupFormProps) {
  const [country, setCountry] = useState<'India' | 'Other'>('India');
  const [gender, setGender] = useState<UserProfile['gender'] | ''>('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Validation states for this form
  const [genderError, setGenderError] = useState('');
  const [countryCodeError, setCountryCodeError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  // Validation functions (can be moved to a utils file if shared)
  const validateGender = (val: string) => !val ? 'Gender is required.' : '';
  const validateCountryCode = (val: string) => {
    if (!val.trim()) return 'Country Code is required.';
    if (!val.startsWith('+')) return "Country code must start with '+'.";
    if (val.trim().length < 2 || val.trim().length > 4) return "Invalid country code length (e.g. +91, +1).";
    return '';
  };
  const validatePhoneNumber = (val: string) => {
    if (!val.trim()) return 'Phone Number is required.';
    if (!/^\d{7,15}$/.test(val)) return 'Phone number must be 7-15 digits.';
    return '';
  };
  
  useEffect(() => {
    if (passedReferralCodeProp) {
      setReferralCode(passedReferralCodeProp.trim().toUpperCase());
    }
  }, [passedReferralCodeProp]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const currentGenderError = validateGender(gender);
    const currentCountryCodeError = validateCountryCode(countryCode);
    const currentPhoneNumberError = validatePhoneNumber(phoneNumber);

    setGenderError(currentGenderError);
    setCountryCodeError(currentCountryCodeError);
    setPhoneNumberError(currentPhoneNumberError);

    if (currentGenderError || currentCountryCodeError || currentPhoneNumberError || !country) {
      setFormError("Please fill all required fields and correct any errors.");
      return;
    }
    await onSubmit({ country, gender, countryCode, phoneNumber, referralCode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthError message={formError} />
      <div className="space-y-1">
        <Label htmlFor="post_signup_displayName">Display Name</Label>
        <Input
          id="post_signup_displayName"
          type="text"
          value={initialDisplayName}
          disabled // Display name from Google is not editable here
          className="text-base bg-muted/50"
        />
         <p className="text-xs text-muted-foreground">Your display name from Google. You can change this later in your profile.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="post_signup_country">Country <span className="text-destructive">*</span></Label>
        <Select value={country} onValueChange={setCountry} required disabled={isLoading}>
          <SelectTrigger id="post_signup_country" className="text-base">
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="India">India (INR ₹)</SelectItem>
            <SelectItem value="Other">Other (USD $)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="post_signup_gender">Gender <span className="text-destructive">*</span></Label>
        <Select value={gender} onValueChange={(v) => { setGender(v as UserProfile['gender'] | ''); if(genderError) setGenderError('');}} required disabled={isLoading}>
          <SelectTrigger id="post_signup_gender" className="text-base">
            <SelectValue placeholder="Select your gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
        {genderError && <p className="text-xs text-destructive mt-1">{genderError}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 space-y-1">
          <Label htmlFor="post_signup_countryCode">Code <span className="text-destructive">*</span></Label>
          <Input
            id="post_signup_countryCode"
            type="text"
            value={countryCode}
            onChange={(e) => {setCountryCode(e.target.value); if(countryCodeError) setCountryCodeError('');}}
            onBlur={() => setCountryCodeError(validateCountryCode(countryCode))}
            placeholder="+91"
            required
            className="text-base"
            disabled={isLoading}
          />
          {countryCodeError && <p className="text-xs text-destructive mt-1">{countryCodeError}</p>}
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="post_signup_phoneNumber">Phone <span className="text-destructive">*</span></Label>
          <Input
            id="post_signup_phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => {setPhoneNumber(e.target.value); if(phoneNumberError) setPhoneNumberError('');}}
            onBlur={() => setPhoneNumberError(validatePhoneNumber(phoneNumber))}
            placeholder="Your phone number"
            required
            className="text-base"
            disabled={isLoading}
          />
          {phoneNumberError && <p className="text-xs text-destructive mt-1">{phoneNumberError}</p>}
        </div>
      </div>
       <p className="text-xs text-muted-foreground">Your phone number is used for account purposes only.</p>


      <div className="space-y-1">
        <Label htmlFor="post_signup_referralCode" className="flex items-center">
          <UserPlus size={16} className="mr-1 text-muted-foreground" /> Referral Code (Optional)
        </Label>
        <Input
          id="post_signup_referralCode"
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="Enter 5-character code"
          className="text-base"
          maxLength={5}
          disabled={isLoading || isLoadingPlatformSettings || !referralProgramEnabled}
        />
        {isLoadingPlatformSettings && <p className="text-xs text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin inline-block" />Loading referral status...</p>}
        {!isLoadingPlatformSettings && !referralProgramEnabled && (
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            <AlertCircle size={14} /> The referral program is currently disabled.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
            Cancel
        </Button>
        <Button type="submit" className="w-full sm:flex-grow" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {isLoading ? 'Saving...' : 'Complete Sign Up'}
        </Button>
      </div>
    </form>
  );
}
