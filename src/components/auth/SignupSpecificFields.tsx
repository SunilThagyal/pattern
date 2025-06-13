
"use client";

import type { UserProfile } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Globe, UserCircle2, Phone, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

interface SignupSpecificFieldsProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onDisplayNameBlur: () => void;
  displayNameError: string;

  country: 'India' | 'Other';
  onCountryChange: (value: 'India' | 'Other') => void;

  gender: UserProfile['gender'] | '';
  onGenderChange: (value: UserProfile['gender'] | '') => void;

  countryCode: string;
  onCountryCodeChange: (value: string) => void;
  onCountryCodeBlur: () => void;
  countryCodeError: string;

  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  onPhoneNumberBlur: () => void;
  phoneNumberError: string;

  referralCodeInput: string;
  onReferralCodeInputChange: (value: string) => void;

  isLoading: boolean;
  referralProgramEnabled: boolean;
  isLoadingPlatformSettings: boolean;
}

export function SignupSpecificFields({
  displayName, onDisplayNameChange, onDisplayNameBlur, displayNameError,
  country, onCountryChange,
  gender, onGenderChange,
  countryCode, onCountryCodeChange, onCountryCodeBlur, countryCodeError,
  phoneNumber, onPhoneNumberChange, onPhoneNumberBlur, phoneNumberError,
  referralCodeInput, onReferralCodeInputChange,
  isLoading, referralProgramEnabled, isLoadingPlatformSettings
}: SignupSpecificFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="displayName_auth_signup_fields">Display Name <span className="text-destructive">*</span></Label>
        <Input
          id="displayName_auth_signup_fields"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          onBlur={onDisplayNameBlur}
          placeholder="Your game name"
          required
          className="text-base"
          disabled={isLoading}
        />
        {displayNameError && <p className="text-xs text-destructive mt-1">{displayNameError}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="country_auth_signup_fields" className="flex items-center">
          <Globe size={16} className="mr-1 text-muted-foreground" /> Country <span className="text-destructive">*</span>
        </Label>
        <Select
          value={country}
          onValueChange={onCountryChange}
          required
          disabled={isLoading}
        >
          <SelectTrigger id="country_auth_signup_fields" className="text-base">
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="India">India (INR ₹)</SelectItem>
            <SelectItem value="Other">Other (USD $)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="gender_auth_signup_fields" className="flex items-center">
          <UserCircle2 size={16} className="mr-1 text-muted-foreground" /> Gender <span className="text-destructive">*</span>
        </Label>
        <Select
          value={gender}
          onValueChange={onGenderChange}
          required
          disabled={isLoading}
        >
          <SelectTrigger id="gender_auth_signup_fields" className="text-base">
            <SelectValue placeholder="Select your gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 space-y-1">
          <Label htmlFor="country_code_auth_signup_fields">Code <span className="text-destructive ml-1">*</span></Label>
          <Input
            id="country_code_auth_signup_fields"
            name="countryCode"
            type="text"
            value={countryCode}
            onChange={(e) => onCountryCodeChange(e.target.value)}
            onBlur={onCountryCodeBlur}
            placeholder="+91"
            required
            className="text-base"
            disabled={isLoading}
          />
          {countryCodeError && <p className="text-xs text-destructive mt-1">{countryCodeError}</p>}
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="phone_number_auth_signup_fields" className="flex items-center">
            <Phone size={16} className="mr-1 text-muted-foreground" /> Phone <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="phone_number_auth_signup_fields"
            name="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneNumberChange(e.target.value)}
            onBlur={onPhoneNumberBlur}
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
        <Label htmlFor="referral_code_signup_fields" className="flex items-center">
          <UserPlus size={16} className="mr-1 text-muted-foreground" /> Referral Code (Optional)
        </Label>
        <Input
          id="referral_code_signup_fields"
          name="referral_code"
          type="text"
          value={referralCodeInput}
          onChange={(e) => onReferralCodeInputChange(e.target.value.toUpperCase())}
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
    </>
  );
}
