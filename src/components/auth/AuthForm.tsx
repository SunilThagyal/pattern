
"use client";

import { useState, type FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { database, auth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut as firebaseSignOut, type User,
  GoogleAuthProvider, signInWithPopup, updateEmail as firebaseUpdateEmail
} from "firebase/auth";
import type { UserProfile } from '@/lib/types';
import { ref, set, get, serverTimestamp, onValue, off, update } from 'firebase/database';
import Link from 'next/link';

import { AuthCard } from './AuthCard';
import { AuthHeaderContent } from './AuthHeaderContent';
import { AuthError } from './AuthError';
import { EmailPasswordFields } from './EmailPasswordFields';
import { SignupSpecificFields } from './SignupSpecificFields';
import { AuthSubmitActions } from './AuthSubmitActions';
import { AuthModeToggle } from './AuthModeToggle';
import { AwaitingVerificationContent } from './AwaitingVerificationContent';
import { Button } from '@/components/ui/button'; // For Forgot Password link on login

const generateShortAlphaNumericCode = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length)); // Fixed: charactersLength -> characters.length
  }
  return result;
};

const LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY = 'drawlyDeviceOriginalReferrerUid';
const LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT = 'drawlyLastVerificationEmailSentAt';
const EMAIL_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

interface AuthFormProps {
  passedReferralCodeProp?: string | null;
  initialActionProp?: string | null;
  forceSignupFromPath?: boolean;
  redirectAfterAuth?: string | null;
}

const determineInitialIsSigningUp = (
  currentForceSignup: boolean,
  currentInitialAction?: string | null,
  currentReferralCode?: string | null
): boolean => {
  if (currentForceSignup) return true;
  if (currentReferralCode && currentReferralCode.trim() !== "" && currentInitialAction !== 'login') return true;
  if (currentInitialAction === 'signup') return true;
  if (currentInitialAction === 'login') return false;
  return false;
};

export default function AuthForm({
  passedReferralCodeProp,
  initialActionProp,
  forceSignupFromPath = false,
  redirectAfterAuth = '/',
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [country, setCountry] = useState<'India' | 'Other'>('India');
  const [gender, setGender] = useState<UserProfile['gender'] | ''>('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [authActionState, setAuthActionState] = useState<'default' | 'awaitingVerification' | 'resetPassword'>('default');
  const [unverifiedUserEmail, setUnverifiedUserEmail] = useState<string | null>(null);
  const [newEmailForVerification, setNewEmailForVerification] = useState('');

  const [isSigningUp, setIsSigningUp] = useState<boolean>(() =>
    determineInitialIsSigningUp(forceSignupFromPath, initialActionProp, passedReferralCodeProp)
  );
  
  const [error, setError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [countryCodeError, setCountryCodeError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [isLoadingPlatformSettings, setIsLoadingPlatformSettings] = useState(true);

  // Validation functions
  const validateDisplayName = (name: string) => !name.trim() ? 'Display Name is required.' : '';
  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(val)) return 'Invalid email format.';
    return '';
  };
  const validatePassword = (val: string) => {
    if (!val) return 'Password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters.';
    return '';
  };
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

  const handleDisplayNameChange = (value: string) => { setDisplayName(value); if (displayNameError) setDisplayNameError(''); };
  const handleEmailChange = (value: string) => { setEmail(value); if (emailError) setEmailError(''); };
  const handlePasswordChange = (value: string) => { setPassword(value); if (passwordError) setPasswordError(''); };
  const handleCountryCodeChange = (value: string) => { setCountryCode(value); if (countryCodeError) setCountryCodeError(''); };
  const handlePhoneNumberChange = (value: string) => { setPhoneNumber(value); if (phoneNumberError) setPhoneNumberError(''); };
  const handleReferralCodeInputChange = (value: string) => setReferralCodeInput(value);

  const handleDisplayNameBlur = () => setDisplayNameError(validateDisplayName(displayName));
  const handleEmailBlur = () => setEmailError(validateEmail(email));
  const handlePasswordBlur = () => setPasswordError(validatePassword(password));
  const handleCountryCodeBlur = () => setCountryCodeError(validateCountryCode(countryCode));
  const handlePhoneNumberBlur = () => setPhoneNumberError(validatePhoneNumber(phoneNumber));


  useEffect(() => {
    const settingsRef = ref(database, 'platformSettings');
    const listener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setReferralProgramEnabled(snapshot.val().referralProgramEnabled !== false);
      } else {
        setReferralProgramEnabled(true);
      }
      setIsLoadingPlatformSettings(false);
    }, (err) => {
      setReferralProgramEnabled(true);
      setIsLoadingPlatformSettings(false);
    });
    return () => off(settingsRef, 'value', listener);
  }, []);

  useEffect(() => {
    const propDrivenIsSigningUp = determineInitialIsSigningUp(forceSignupFromPath, initialActionProp, passedReferralCodeProp);
    const propDrivenAuthAction = initialActionProp === 'resetPassword' ? 'resetPassword' : 'default';

    if (isSigningUp !== propDrivenIsSigningUp) {
        setIsSigningUp(propDrivenIsSigningUp);
    }
    if (authActionState !== 'awaitingVerification' && authActionState !== propDrivenAuthAction) {
        setAuthActionState(propDrivenAuthAction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedReferralCodeProp, initialActionProp, forceSignupFromPath]);

  useEffect(() => {
    if (authActionState !== 'awaitingVerification') {
      setError(null);
      setDisplayNameError(''); setEmailError(''); setPasswordError('');
      setCountryCodeError(''); setPhoneNumberError('');
    }
  }, [isSigningUp, authActionState]);


  useEffect(() => {
    setReferralCodeInput(passedReferralCodeProp?.trim().toUpperCase() || '');
  }, [passedReferralCodeProp]);

  const handleFirebaseEmailAuth = async () => {
    setError(null);
    const currentEmailError = validateEmail(email);
    const currentPasswordError = validatePassword(password);
    setEmailError(currentEmailError);
    setPasswordError(currentPasswordError);

    let currentDisplayNameError = '';
    let currentCountryCodeError = '';
    let currentPhoneNumberError = '';

    if (isSigningUp) {
      currentDisplayNameError = validateDisplayName(displayName);
      currentCountryCodeError = validateCountryCode(countryCode);
      currentPhoneNumberError = validatePhoneNumber(phoneNumber);
      setDisplayNameError(currentDisplayNameError);
      setCountryCodeError(currentCountryCodeError);
      setPhoneNumberError(currentPhoneNumberError);

      if (currentDisplayNameError || currentEmailError || currentPasswordError || currentCountryCodeError || currentPhoneNumberError || !country || !gender) {
         setError("Please fill all required fields and correct any errors.");
         setIsLoadingEmail(false);
         return;
      }
    } else {
       if (currentEmailError || currentPasswordError) {
          setError("Please correct the errors above.");
          setIsLoadingEmail(false);
          return;
       }
    }
    setIsLoadingEmail(true);
    if (isSigningUp) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (user) {
          await sendEmailVerification(user);
          let newShortReferralCode = '';
          let attempts = 0; 
          if (referralProgramEnabled) {
              let codeExists = true; 
              while(codeExists && attempts < 10) {
                  newShortReferralCode = generateShortAlphaNumericCode(5);
                  codeExists = (await get(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`))).exists();
                  attempts++;
              }
              if (codeExists) console.warn("Could not generate unique referral code.");
          }
          const newUserProfile: UserProfile = {
            userId: user.uid, displayName: displayName.trim(), email: user.email || email,
            referralCode: user.uid, shortReferralCode: referralProgramEnabled && newShortReferralCode ? newShortReferralCode : undefined,
            totalEarnings: 0, createdAt: serverTimestamp() as number, country: country,
            currency: country === 'India' ? 'INR' : 'USD', gender: gender as UserProfile['gender'],
            countryCode: countryCode.trim(), phoneNumber: phoneNumber.trim(), canWithdraw: true,
          };
          if (referralProgramEnabled) {
            let actualReferrerUid: string | null = null;
            const deviceOriginalReferrerUid = localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY);
            const currentReferralShortCodeFromInput = referralCodeInput.trim().toUpperCase();
            if (deviceOriginalReferrerUid) {
              actualReferrerUid = deviceOriginalReferrerUid;
              if (currentReferralShortCodeFromInput && (await get(ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`))).val() !== deviceOriginalReferrerUid) {
                toast({ title: "Referral Overridden", description: "Original referral applied.", variant: "default" });
              }
            } else if (currentReferralShortCodeFromInput) {
              const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`));
              if (mapSnap.exists()) {
                const foundUid = mapSnap.val() as string;
                if (foundUid === user.uid) toast({title: "Invalid Referral", description: "Cannot refer self."});
                else { actualReferrerUid = foundUid; localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundUid); toast({title: "Referral Applied!"});}
              } else toast({ title: "Referral Code Invalid", variant: "default" });
            }
            if (actualReferrerUid) {
              newUserProfile.referredBy = actualReferrerUid;
              await set(ref(database, `referrals/${actualReferrerUid}/${user.uid}`), { referredUserName: displayName.trim(), timestamp: serverTimestamp() });
            }
          }
          await set(ref(database, `users/${user.uid}`), newUserProfile);
          if (referralProgramEnabled && newShortReferralCode) await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), user.uid);
          setUnverifiedUserEmail(user.email); setAuthActionState('awaitingVerification');
          toast({ title: "Sign Up Almost Complete!", description: `Welcome, ${displayName}! Verify ${email}.` });
        }
      } catch (fbError: any) {
        if (fbError.code === 'auth/email-already-in-use') { setError("Email already in use."); setEmailError("Email already in use."); }
        else if (fbError.code === 'auth/weak-password') { setPasswordError("Password min 6 chars."); setError("Password min 6 chars."); }
        else setError(fbError.message || "Signup failed.");
      }
    } else { // Login
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (user) {
          if (!user.emailVerified) {
            setUnverifiedUserEmail(user.email); setAuthActionState('awaitingVerification'); setIsLoadingEmail(false); return;
          }
          const profileSnap = await get(ref(database, `users/${user.uid}`));
          const nameFromDB = profileSnap.exists() ? profileSnap.val().displayName || "Player" : "Player";
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); localStorage.setItem('drawlyUserDisplayName', nameFromDB); localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Login Successful!", description: `Welcome back, ${nameFromDB}!` });
          router.push(redirectAfterAuth || '/');
        }
      } catch (fbError: any) {
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(fbError.code)) setError("Invalid email or password.");
        else setError(fbError.message || "Login failed.");
      }
    }
    setIsLoadingEmail(false);
  };
  
  const handleGoogleAuth = async () => {
    setIsLoadingGoogle(true); setError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      if (user) {
        const profileSnap = await get(ref(database, `users/${user.uid}`));
        let nameFromAuth = user.displayName || "Google User";
        if (!user.email) { toast({ title: "Email Missing", variant: "destructive" }); setIsLoadingGoogle(false); return; }
        if (profileSnap.exists()) {
          nameFromAuth = profileSnap.val().displayName || nameFromAuth;
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); localStorage.setItem('drawlyUserDisplayName', nameFromAuth); localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Login Successful!", description: `Welcome, ${nameFromAuth}!` });
          router.push(redirectAfterAuth || '/');
        } else {
          let newShortReferralCode = '';
          let attempts = 0;
          if (referralProgramEnabled) {
            let codeExists = true; 
            while(codeExists && attempts < 10) {
              newShortReferralCode = generateShortAlphaNumericCode(5);
              codeExists = (await get(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`))).exists(); attempts++;
            }
            if (codeExists) console.warn("Could not generate unique Google referral code.");
          }
          const newUserProfile: UserProfile = {
            userId: user.uid, displayName: nameFromAuth, email: user.email, referralCode: user.uid,
            shortReferralCode: referralProgramEnabled && newShortReferralCode ? newShortReferralCode : undefined,
            totalEarnings: 0, createdAt: serverTimestamp() as number, country: 'India', currency: 'INR',
            gender: 'prefer_not_to_say', countryCode: '', phoneNumber: '', canWithdraw: true,
          };
          if (referralProgramEnabled) {
            let actualReferrerUid: string | null = null;
            const deviceReferrer = localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY);
            const propReferrerShort = passedReferralCodeProp?.trim().toUpperCase();
            if (propReferrerShort) {
                const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${propReferrerShort}`));
                if (mapSnap.exists()) {
                    const foundUid = mapSnap.val() as string;
                    if (foundUid !== user.uid) { actualReferrerUid = foundUid; if (!deviceReferrer || deviceReferrer !== foundUid) localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundUid); }
                }
            }
            if (!actualReferrerUid && deviceReferrer && deviceReferrer !== user.uid) actualReferrerUid = deviceReferrer;
            if (actualReferrerUid) {
              newUserProfile.referredBy = actualReferrerUid;
              await set(ref(database, `referrals/${actualReferrerUid}/${user.uid}`), { referredUserName: nameFromAuth, timestamp: serverTimestamp() });
              toast({title: "Referral Applied!"});
            } else if (propReferrerShort) toast({title: "Referral Code Invalid", variant: "default"});
          }
          await set(ref(database, `users/${user.uid}`), newUserProfile);
          if (referralProgramEnabled && newShortReferralCode) await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), user.uid);
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); localStorage.setItem('drawlyUserDisplayName', nameFromAuth); localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Account Created!", description: `Welcome, ${nameFromAuth}!` });
          router.push(redirectAfterAuth || '/');
        }
      } else setError("Google Sign-In failed: No user data.");
    } catch (fbError: any) {
      if (fbError.code === 'auth/popup-closed-by-user') { setError("Google Sign-In cancelled."); toast({ title: "Sign-In Cancelled", variant: "default" }); }
      else if (fbError.code === 'auth/account-exists-with-different-credential') { setError("Account exists with different sign-in method."); toast({ title: "Account Conflict", variant: "destructive", duration: 7000 }); }
      else setError(fbError.message || "Google Sign-In failed.");
    } finally { setIsLoadingGoogle(false); }
  };

  const handleForgotPassword = async () => {
    setError(null);
    const currentEmailError = validateEmail(email); setEmailError(currentEmailError);
    if (currentEmailError) { setError("Enter a valid email for password reset."); return; }
    setIsLoadingEmail(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({ title: "Password Reset Email Sent", description: `If ${email.trim()} exists, a reset link was sent.`, duration: 7000 });
      setAuthActionState('default');
    } catch (fbError: any) {
      if (fbError.code === 'auth/invalid-email') { setEmailError("Invalid email format."); setError("Check email format."); }
      else if (fbError.code === 'auth/missing-email') { setEmailError("Enter email."); setError("Enter email."); }
      else setError("Could not send reset email. Try later.");
    } finally { setIsLoadingEmail(false); }
  };

  const handleResendVerificationEmail = async () => {
    if (!auth.currentUser) { toast({ title: "Error", description: "No user session. Log in again.", variant: "destructive" }); setAuthActionState('default'); return; }
    setIsResendingVerification(true);
    const lastSent = Number(localStorage.getItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT));
    if (Date.now() - lastSent < EMAIL_RESEND_COOLDOWN_MS) {
      toast({ title: "Please Wait", description: `Resend available in ${Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 60000)} min(s).`, variant: "default" });
      setIsResendingVerification(false); return;
    }
    try {
      await sendEmailVerification(auth.currentUser);
      localStorage.setItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT, Date.now().toString());
      toast({ title: "Verification Email Resent", description: `New email sent to ${auth.currentUser.email}.` });
    } catch (error: any) { toast({ title: "Error", description: error.message || "Could not resend.", variant: "destructive" });
    } finally { setIsResendingVerification(false); }
  };

  const handleUpdateEmail = async () => {
    if (!auth.currentUser) { toast({ title: "Error", description: "No user session.", variant: "destructive" }); setAuthActionState('default'); return; }
    const newEmailValError = validateEmail(newEmailForVerification.trim());
    if (newEmailValError) { toast({ title: "Invalid Email", description: newEmailValError, variant: "destructive" }); return; }
    setIsUpdatingEmail(true);
    try {
      const user = auth.currentUser;
      await firebaseUpdateEmail(user, newEmailForVerification.trim());
      await update(ref(database, `users/${user.uid}`), { email: newEmailForVerification.trim() });
      await sendEmailVerification(user);
      setUnverifiedUserEmail(newEmailForVerification.trim()); setNewEmailForVerification('');
      toast({ title: "Email Updated", description: `Email updated to ${newEmailForVerification.trim()}. New verification sent.` });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') toast({ title: "Re-authentication Required", description: "Log out and log back in to change email.", variant: "destructive", duration: 7000 });
      else if (error.code === 'auth/email-already-in-use') toast({ title: "Email In Use", description: "Email already associated with another account.", variant: "destructive"});
      else toast({ title: "Error", description: error.message || "Could not update email.", variant: "destructive" });
    } finally { setIsUpdatingEmail(false); }
  };

  const handleUserLogoutForVerificationScreen = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('drawlyAuthStatus'); localStorage.removeItem('drawlyUserDisplayName'); localStorage.removeItem('drawlyUserUid');
    setAuthActionState('default'); setUnverifiedUserEmail(null); setEmail(''); setPassword('');
    setError(null); setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');
    toast({ title: "Logged Out" });
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (authActionState === 'resetPassword') handleForgotPassword();
    else if (authActionState === 'default') handleFirebaseEmailAuth();
  };

  const handleToggleMode = (mode: 'login' | 'signup' | 'resetPassword') => {
    setError(null);
    setDisplayNameError(''); setEmailError(''); setPasswordError('');
    setCountryCodeError(''); setPhoneNumberError('');

    if (mode === 'resetPassword') {
      setAuthActionState('resetPassword');
      setIsSigningUp(false); // Reset password is a form of login flow essentially
    } else if (mode === 'login') {
      setAuthActionState('default');
      setIsSigningUp(false);
    } else { // signup
      setAuthActionState('default');
      setIsSigningUp(true);
    }
  };

  const signupFieldsValid = displayName.trim() && country && gender && countryCode.trim() && phoneNumber.trim() && email.trim() && password.trim();
  const signupErrorsClear = !displayNameError && !emailError && !passwordError && !countryCodeError && !phoneNumberError;
  const canSubmitSignup = signupFieldsValid && signupErrorsClear;
  const loginFieldsValid = email.trim() && password.trim();
  const loginErrorsClear = !emailError && !passwordError;
  const canSubmitLogin = loginFieldsValid && loginErrorsClear;
  const isSubmitDisabled = isLoadingEmail || isLoadingGoogle || (authActionState === 'default' && (isSigningUp ? !canSubmitSignup : !canSubmitLogin));


  let content;
  if (authActionState === 'awaitingVerification') {
    content = (
      <AwaitingVerificationContent
        onResendVerificationEmail={handleResendVerificationEmail}
        isResendingVerification={isResendingVerification}
        newEmailForVerification={newEmailForVerification}
        onNewEmailChange={setNewEmailForVerification}
        onUpdateEmail={handleUpdateEmail}
        isUpdatingEmail={isUpdatingEmail}
        onLogout={handleUserLogoutForVerificationScreen}
        errorMessage={error}
      />
    );
  } else {
    content = (
      <form onSubmit={handleFormSubmit} id="auth-form-main" className="space-y-3">
        <AuthError message={error} />
        {authActionState === 'default' && isSigningUp && (
          <SignupSpecificFields
            displayName={displayName} onDisplayNameChange={handleDisplayNameChange} onDisplayNameBlur={handleDisplayNameBlur} displayNameError={displayNameError}
            country={country} onCountryChange={setCountry}
            gender={gender} onGenderChange={setGender}
            countryCode={countryCode} onCountryCodeChange={handleCountryCodeChange} onCountryCodeBlur={handleCountryCodeBlur} countryCodeError={countryCodeError}
            phoneNumber={phoneNumber} onPhoneNumberChange={handlePhoneNumberChange} onPhoneNumberBlur={handlePhoneNumberBlur} phoneNumberError={phoneNumberError}
            referralCodeInput={referralCodeInput} onReferralCodeInputChange={handleReferralCodeInputChange}
            isLoading={isLoadingEmail || isLoadingGoogle}
            referralProgramEnabled={referralProgramEnabled}
            isLoadingPlatformSettings={isLoadingPlatformSettings}
          />
        )}
        <EmailPasswordFields
          email={email} onEmailChange={handleEmailChange} onEmailBlur={handleEmailBlur} emailError={emailError}
          password={password} onPasswordChange={handlePasswordChange} onPasswordBlur={handlePasswordBlur} passwordError={passwordError}
          isLoading={isLoadingEmail || isLoadingGoogle}
          showPasswordInput={authActionState !== 'resetPassword'}
        />
        {authActionState === 'default' && !isSigningUp && (
             <Button
                type="button" variant="link"
                className="px-0 text-sm text-primary hover:underline h-auto py-0"
                onClick={() => handleToggleMode('resetPassword')}
                disabled={isLoadingEmail || isLoadingGoogle}
            >
                Forgot Password?
            </Button>
        )}
         {/* Submit actions will be rendered by AuthCard's footer prop via AuthSubmitActions */}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <AuthCard
        header={
          <AuthHeaderContent
            mode={authActionState === 'awaitingVerification' ? 'awaitingVerification' : authActionState === 'resetPassword' ? 'resetPassword' : isSigningUp ? 'signup' : 'login'}
            unverifiedUserEmail={unverifiedUserEmail}
          />
        }
        content={content}
        footer={ authActionState !== 'awaitingVerification' ? (
          <>
            <AuthSubmitActions
              authActionState={authActionState}
              isSigningUp={isSigningUp}
              onEmailSubmit={handleFormSubmit} // Pass the main form submit handler
              onGoogleSubmit={handleGoogleAuth}
              isLoadingEmail={isLoadingEmail}
              isLoadingGoogle={isLoadingGoogle}
              isSubmitDisabled={isSubmitDisabled}
            />
            <AuthModeToggle
              authActionState={authActionState}
              isSigningUp={isSigningUp}
              onToggleMode={handleToggleMode}
              isLoading={isLoadingEmail || isLoadingGoogle}
            />
          </>
        ) : undefined}
        showDefaultFooterLinks={authActionState !== 'awaitingVerification'}
        currentAuthActionState={authActionState}
      />
    </div>
  );
}

