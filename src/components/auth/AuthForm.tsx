
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
import { Button } from '@/components/ui/button';

const generateShortAlphaNumericCode = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY = 'drawlyDeviceOriginalReferrerUid';
const LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT = 'drawlyLastVerificationEmailSentAt';
const EMAIL_RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

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
  return false; // Default to login if no specific action
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
      console.error("Error fetching platform settings in AuthForm:", err);
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

  const handleUserVerifiedAndLogin = async () => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      toast({ title: "Verification Error", description: "Email not verified. Please try again.", variant: "destructive" });
      setAuthActionState('default'); 
      return;
    }
    const user = auth.currentUser;
    try {
      const profileSnap = await get(ref(database, `users/${user.uid}`));
      const nameFromDB = profileSnap.exists() ? profileSnap.val().displayName || "Player" : "Player";
      
      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', nameFromDB);
      localStorage.setItem('drawlyUserUid', user.uid);
      
      toast({ title: "Email Verified & Login Successful!", description: `Welcome, ${nameFromDB}!` });
      router.push(redirectAfterAuth || '/');
      setAuthActionState('default'); 
    } catch (dbError) {
        console.error("Error fetching profile after verification:", dbError);
        toast({ title: "Login Error", description: "Could not finalize login. Please try manually.", variant: "destructive" });
        setAuthActionState('default');
    }
  };

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
    } else { // Login
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
                  const shortCodeRef = ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`);
                  codeExists = (await get(shortCodeRef)).exists();
                  attempts++;
              }
              if (codeExists) {
                  console.warn("Could not generate unique short referral code after multiple attempts.");
                  newShortReferralCode = ''; 
              }
          }
          const newUserProfileData: Partial<UserProfile> = { // Use Partial for conditional properties
            userId: user.uid, displayName: displayName.trim(), email: user.email || email,
            referralCode: user.uid, 
            totalEarnings: 0, createdAt: serverTimestamp() as number, country: country,
            currency: country === 'India' ? 'INR' : 'USD', gender: gender as UserProfile['gender'],
            countryCode: countryCode.trim(), phoneNumber: phoneNumber.trim(), canWithdraw: true,
          };
          if (referralProgramEnabled && newShortReferralCode) {
              newUserProfileData.shortReferralCode = newShortReferralCode;
          }
          
          if (referralProgramEnabled) {
            let actualReferrerUid: string | null = null;
            const deviceOriginalReferrerUid = localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY);
            const currentReferralShortCodeFromInput = referralCodeInput.trim().toUpperCase(); 
            
            if (deviceOriginalReferrerUid) {
              actualReferrerUid = deviceOriginalReferrerUid;
              if (currentReferralShortCodeFromInput && (await get(ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`))).val() !== deviceOriginalReferrerUid) {
                toast({ title: "Referral Overridden", description: "An earlier referral code from this device was applied.", variant: "default" });
              }
            } else if (currentReferralShortCodeFromInput) {
              const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`));
              if (mapSnap.exists()) {
                const foundUid = mapSnap.val() as string;
                if (foundUid === user.uid) {
                    toast({title: "Invalid Referral", description: "You cannot refer yourself.", variant: "destructive"});
                } else {
                    actualReferrerUid = foundUid;
                    localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundUid);
                    toast({title: "Referral Applied!", description: "Referral code successfully applied."});
                }
              } else {
                toast({ title: "Referral Code Invalid", description: `The code "${currentReferralShortCodeFromInput}" is not valid.`, variant: "default" });
              }
            }
            
            if (actualReferrerUid) {
              newUserProfileData.referredBy = actualReferrerUid;
              await set(ref(database, `referrals/${actualReferrerUid}/${user.uid}`), {
                referredUserName: displayName.trim(),
                timestamp: serverTimestamp()
              });
            }
          }
          await set(ref(database, `users/${user.uid}`), newUserProfileData);
          if (referralProgramEnabled && newShortReferralCode) {
            await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), user.uid);
          }
          
          setUnverifiedUserEmail(user.email); 
          setAuthActionState('awaitingVerification');
          toast({ title: "Sign Up Almost Complete!", description: `Welcome, ${displayName}! A verification email has been sent to ${email}. Please check your inbox.` });
        }
      } catch (fbError: any) {
        if (fbError.code === 'auth/email-already-in-use') { setError("An account already exists with this email address."); setEmailError("Email already in use."); }
        else if (fbError.code === 'auth/weak-password') { setPasswordError("Password should be at least 6 characters."); setError("Password is too weak."); }
        else setError(fbError.message || "Signup failed. Please try again.");
      }
    } else { // Login
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (user) {
          if (!user.emailVerified) {
            setUnverifiedUserEmail(user.email); 
            setAuthActionState('awaitingVerification'); 
            setIsLoadingEmail(false); 
            return;
          }
          const profileSnap = await get(ref(database, `users/${user.uid}`));
          const nameFromDB = profileSnap.exists() ? profileSnap.val().displayName || "Player" : "Player";
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); 
          localStorage.setItem('drawlyUserDisplayName', nameFromDB); 
          localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Login Successful!", description: `Welcome back, ${nameFromDB}!` });
          router.push(redirectAfterAuth || '/');
        }
      } catch (fbError: any) {
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(fbError.code)) setError("Invalid email or password. Please check your credentials.");
        else setError(fbError.message || "Login failed. Please try again.");
      }
    }
    setIsLoadingEmail(false);
  };
  
  const handleGoogleAuth = async () => {
    setIsLoadingGoogle(true); setError(null);
    console.log('[AuthForm GoogleAuth] Initial passedReferralCodeProp:', passedReferralCodeProp);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      if (user) {
        const profileSnap = await get(ref(database, `users/${user.uid}`));
        let nameFromAuth = user.displayName || "Google User";
        if (!user.email) { toast({ title: "Email Missing", description: "Google account did not provide an email.", variant: "destructive" }); setIsLoadingGoogle(false); return; }
        
        if (profileSnap.exists()) { 
          nameFromAuth = profileSnap.val().displayName || nameFromAuth; 
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); 
          localStorage.setItem('drawlyUserDisplayName', nameFromAuth); 
          localStorage.setItem('drawlyUserUid', user.uid);
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
            if (codeExists) console.warn("Could not generate unique short referral code for Google user."); newShortReferralCode = '';
          }

          const newUserProfileData: Partial<UserProfile> = { // Use Partial
            userId: user.uid, displayName: nameFromAuth, email: user.email, referralCode: user.uid,
            totalEarnings: 0, createdAt: serverTimestamp() as number, country: 'India', currency: 'INR', 
            gender: 'prefer_not_to_say', countryCode: '', phoneNumber: '', canWithdraw: true,
          };
          if (referralProgramEnabled && newShortReferralCode) {
              newUserProfileData.shortReferralCode = newShortReferralCode;
          }

          if (referralProgramEnabled) {
            let actualReferrerUid: string | null = null;
            const deviceReferrer = localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY);
            const propReferrerShort = passedReferralCodeProp?.trim().toUpperCase();
            console.log('[AuthForm GoogleAuth] propReferrerShort for Google new user:', propReferrerShort);
            
            if (propReferrerShort) { 
                const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${propReferrerShort}`));
                if (mapSnap.exists()) {
                    const foundUid = mapSnap.val() as string;
                    if (foundUid !== user.uid) {
                        actualReferrerUid = foundUid;
                        if (!deviceReferrer || deviceReferrer !== foundUid) { 
                            localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundUid);
                        }
                    } else {
                        toast({title: "Invalid Referral", description: "You cannot refer yourself.", variant: "destructive"});
                    }
                } else {
                    toast({title: "Referral Code Invalid", description: `The code "${propReferrerShort}" is not valid.`, variant: "default"});
                }
            } else if (deviceReferrer && deviceReferrer !== user.uid) {
                actualReferrerUid = deviceReferrer;
            }

            if (actualReferrerUid) {
              newUserProfileData.referredBy = actualReferrerUid;
              await set(ref(database, `referrals/${actualReferrerUid}/${user.uid}`), {
                referredUserName: nameFromAuth,
                timestamp: serverTimestamp()
              });
              toast({title: "Referral Applied!", description: "Referral code successfully applied."});
            }
          }

          await set(ref(database, `users/${user.uid}`), newUserProfileData);
          if (referralProgramEnabled && newShortReferralCode) {
            await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), user.uid);
          }
          
          localStorage.setItem('drawlyAuthStatus', 'loggedIn'); 
          localStorage.setItem('drawlyUserDisplayName', nameFromAuth); 
          localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Account Created & Logged In!", description: `Welcome, ${nameFromAuth}!` });
          router.push(redirectAfterAuth || '/');
        }
      } else {
        setError("Google Sign-In failed: No user data returned from Google.");
      }
    } catch (fbError: any) {
      if (fbError.code === 'auth/popup-closed-by-user') { setError(null); toast({ title: "Google Sign-In Cancelled", description: "You closed the Google Sign-In window.", variant: "default" }); }
      else if (fbError.code === 'auth/account-exists-with-different-credential') { setError("An account already exists with this email, but using a different sign-in method (e.g., email/password). Please log in with that method."); toast({ title: "Account Conflict", description: "Email already in use with a different sign-in method.", variant: "destructive", duration: 7000 }); }
      else setError(fbError.message || "Google Sign-In failed. Please try again.");
    } finally { setIsLoadingGoogle(false); }
  };

  const handleForgotPassword = async () => {
    setError(null);
    const currentEmailError = validateEmail(email); setEmailError(currentEmailError);
    if (currentEmailError) { setError("Please enter a valid email address to reset your password."); return; }
    setIsLoadingEmail(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({ title: "Password Reset Email Sent", description: `If an account exists for ${email.trim()}, a password reset link has been sent. Please check your inbox.`, duration: 7000 });
      setAuthActionState('default'); 
    } catch (fbError: any) {
      if (fbError.code === 'auth/invalid-email') { setEmailError("The email address is not valid."); setError("Please check the email format."); }
      else if (fbError.code === 'auth/missing-email') { setEmailError("Email address is required."); setError("Please enter your email address."); }
      else setError("Could not send password reset email. Please try again later.");
    } finally { setIsLoadingEmail(false); }
  };

  const handleResendVerificationEmail = async () => {
    if (!auth.currentUser) { 
      toast({ title: "Error", description: "No active user session. Please log in again.", variant: "destructive" }); 
      setAuthActionState('default'); 
      return; 
    }
    setIsResendingVerification(true);
    const lastSentTimestamp = Number(localStorage.getItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT));
    if (Date.now() - lastSentTimestamp < EMAIL_RESEND_COOLDOWN_MS) {
      toast({ title: "Please Wait", description: `You can resend the verification email in ${Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (Date.now() - lastSentTimestamp)) / 60000)} minute(s).`, variant: "default" });
      setIsResendingVerification(false); 
      return;
    }
    try {
      await sendEmailVerification(auth.currentUser);
      localStorage.setItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT, Date.now().toString());
      toast({ title: "Verification Email Resent", description: `A new verification email has been sent to ${auth.currentUser.email}.` });
    } catch (error: any) { 
      toast({ title: "Error Resending Email", description: error.message || "Could not resend verification email.", variant: "destructive" });
    } finally { 
      setIsResendingVerification(false); 
    }
  };

  const handleUpdateEmail = async () => {
    if (!auth.currentUser) { 
      toast({ title: "Error", description: "No active user session.", variant: "destructive" }); 
      setAuthActionState('default'); 
      return; 
    }
    const newEmailValError = validateEmail(newEmailForVerification.trim());
    if (newEmailValError) { 
      toast({ title: "Invalid New Email", description: newEmailValError, variant: "destructive" }); 
      return; 
    }
    setIsUpdatingEmail(true);
    try {
      const user = auth.currentUser;
      const oldEmail = user.email; 
      await firebaseUpdateEmail(user, newEmailForVerification.trim());
      await update(ref(database, `users/${user.uid}`), { email: newEmailForVerification.trim() });
      await sendEmailVerification(user); 
      setUnverifiedUserEmail(newEmailForVerification.trim()); 
      setNewEmailForVerification(''); 
      toast({ title: "Email Address Updated", description: `Your email has been changed from ${oldEmail} to ${newEmailForVerification.trim()}. A new verification email has been sent.` });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ title: "Re-authentication Required", description: "For security, please log out and log back in to change your email address.", variant: "destructive", duration: 7000 });
      } else if (error.code === 'auth/email-already-in-use') {
        toast({ title: "Email Already In Use", description: "This email address is already associated with another account.", variant: "destructive"});
      } else {
        toast({ title: "Error Updating Email", description: error.message || "Could not update email address.", variant: "destructive" });
      }
    } finally { 
      setIsUpdatingEmail(false); 
    }
  };

  const handleUserLogoutForVerificationScreen = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('drawlyAuthStatus'); 
    localStorage.removeItem('drawlyUserDisplayName'); 
    localStorage.removeItem('drawlyUserUid');
    setAuthActionState('default'); 
    setUnverifiedUserEmail(null); 
    setEmail(''); setPassword(''); 
    setError(null); setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');
    toast({ title: "Logged Out", description: "You have been logged out." });
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
      setIsSigningUp(false); 
    } else if (mode === 'login') {
      setAuthActionState('default');
      setIsSigningUp(false);
    } else { 
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
  const isSubmitDisabled = isLoadingEmail || isLoadingGoogle || 
                           (authActionState === 'default' && (isSigningUp ? !canSubmitSignup : !canSubmitLogin)) ||
                           (authActionState === 'resetPassword' && (!email.trim() || !!emailError) );


  let content;
  if (authActionState === 'awaitingVerification') {
    content = (
      <AwaitingVerificationContent
        unverifiedUserEmail={unverifiedUserEmail}
        onResendVerificationEmail={handleResendVerificationEmail}
        isResendingVerification={isResendingVerification}
        newEmailForVerification={newEmailForVerification}
        onNewEmailChange={setNewEmailForVerification}
        onUpdateEmail={handleUpdateEmail}
        isUpdatingEmail={isUpdatingEmail}
        onLogout={handleUserLogoutForVerificationScreen}
        errorMessage={error} 
        onUserVerifiedAndModalConfirmed={handleUserVerifiedAndLogin} 
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
              onEmailSubmit={handleFormSubmit} 
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

