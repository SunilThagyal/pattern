
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

import { AuthCard } from './AuthCard';
import { AuthHeaderContent } from './AuthHeaderContent';
import { AuthError } from './AuthError';
import { EmailPasswordFields } from './EmailPasswordFields';
import { SignupSpecificFields } from './SignupSpecificFields';
import { AuthSubmitActions } from './AuthSubmitActions';
import { AuthModeToggle } from './AuthModeToggle';
import { AwaitingVerificationContent } from './AwaitingVerificationContent';
import { ResetPasswordContent } from './ResetPasswordContent';
import { PostGoogleSignupForm } from './PostGoogleSignupForm'; // New Import

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
  return false;
};

export default function AuthForm({
  passedReferralCodeProp,
  initialActionProp,
  forceSignupFromPath = false,
  redirectAfterAuth = '/',
}: AuthFormProps) {
  // Main form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState(''); // For email signup
  const [country, setCountry] = useState<'India' | 'Other'>('India');
  const [gender, setGender] = useState<UserProfile['gender'] | ''>('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Auth flow state
  const [authActionState, setAuthActionState] = useState<'default' | 'awaitingVerification' | 'resetPassword'>('default');
  const [unverifiedUserEmail, setUnverifiedUserEmail] = useState<string | null>(null);
  const [newEmailForVerification, setNewEmailForVerification] = useState('');
  const [isSigningUp, setIsSigningUp] = useState<boolean>(() =>
    determineInitialIsSigningUp(forceSignupFromPath, initialActionProp, passedReferralCodeProp)
  );

  // Post Google Signup State
  const [postGoogleSignupStep, setPostGoogleSignupStep] = useState<'none' | 'collectInfo'>('none');
  const [googleAuthData, setGoogleAuthData] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [countryCodeError, setCountryCodeError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  // Loading states
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isLoadingPostGoogleSignup, setIsLoadingPostGoogleSignup] = useState(false);


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
  const validateGender = (val: string) => !val ? 'Gender is required.' : '';


  // Input change handlers
  const handleDisplayNameChange = (value: string) => { setDisplayName(value); if (displayNameError) setDisplayNameError(''); };
  const handleEmailChange = (value: string) => { setEmail(value); if (emailError) setEmailError(''); };
  const handlePasswordChange = (value: string) => { setPassword(value); if (passwordError) setPasswordError(''); };
  const handleCountryCodeChange = (value: string) => { setCountryCode(value); if (countryCodeError) setCountryCodeError(''); };
  const handlePhoneNumberChange = (value: string) => { setPhoneNumber(value); if (phoneNumberError) setPhoneNumberError(''); };
  const handleReferralCodeInputChange = (value: string) => setReferralCodeInput(value);

  // Input blur handlers for validation
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
    let currentGenderError = '';

    if (isSigningUp) {
      currentDisplayNameError = validateDisplayName(displayName);
      currentCountryCodeError = validateCountryCode(countryCode);
      currentPhoneNumberError = validatePhoneNumber(phoneNumber);
      currentGenderError = validateGender(gender);
      setDisplayNameError(currentDisplayNameError);
      setCountryCodeError(currentCountryCodeError);
      setPhoneNumberError(currentPhoneNumberError);
      // Note: Gender error display would need to be added to SignupSpecificFields or a general error area

      if (currentDisplayNameError || currentEmailError || currentPasswordError || currentCountryCodeError || currentPhoneNumberError || currentGenderError || !country) {
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
          if (referralProgramEnabled) {
            let attempts = 0;
            let codeExists = true;
            while (codeExists && attempts < 10) {
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

          const newUserProfileData: UserProfile = {
            userId: user.uid, displayName: displayName.trim(), email: user.email || email,
            referralCode: user.uid, // This is the user's own UID, used if they refer others
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
                  toast({ title: "Invalid Referral", description: "You cannot refer yourself.", variant: "destructive" });
                } else {
                  actualReferrerUid = foundUid;
                  localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundUid);
                  toast({ title: "Referral Applied!", description: "Referral code successfully applied." });
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
    console.log('[AuthForm GoogleAuth] Attempting Google Sign-In. isLoadingGoogle:', isLoadingGoogle);
    if (isLoadingGoogle) {
      console.log('[AuthForm GoogleAuth] Already processing Google Sign-In. Aborting.');
      return;
    }
    setIsLoadingGoogle(true);
    setError(null);
    console.log('[AuthForm GoogleAuth] Initial passedReferralCodeProp:', passedReferralCodeProp);
    try {
      console.log('[AuthForm GoogleAuth] Calling signInWithPopup...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('[AuthForm GoogleAuth] signInWithPopup successful. Result User:', result.user);
      const user = result.user;
      if (user) {
        const profileSnap = await get(ref(database, `users/${user.uid}`));
        let nameFromAuth = user.displayName || "Google User";
        if (!user.email) {
          console.error('[AuthForm GoogleAuth] Google account did not provide an email.');
          toast({ title: "Email Missing", description: "Google account did not provide an email.", variant: "destructive" });
          setIsLoadingGoogle(false); return;
        }

        if (profileSnap.exists()) { // Existing user
          nameFromAuth = profileSnap.val().displayName || nameFromAuth;
          localStorage.setItem('drawlyAuthStatus', 'loggedIn');
          localStorage.setItem('drawlyUserDisplayName', nameFromAuth);
          localStorage.setItem('drawlyUserUid', user.uid);
          toast({ title: "Login Successful!", description: `Welcome, ${nameFromAuth}!` });
          router.push(redirectAfterAuth || '/');
        } else { // New user - needs to collect additional info
          console.log('[AuthForm GoogleAuth] New Google user detected. Preparing to collect additional info.');
          setGoogleAuthData({ uid: user.uid, email: user.email, displayName: nameFromAuth });
          setPostGoogleSignupStep('collectInfo');
          // Pre-fill referral code for PostGoogleSignupForm if passed via URL
          // This state will be picked up by PostGoogleSignupForm
        }
      } else {
        console.error('[AuthForm GoogleAuth] Google Sign-In failed: No user data returned from Google.');
        setError("Google Sign-In failed: No user data returned from Google.");
      }
    } catch (fbError: any) {
      console.error('[AuthForm GoogleAuth] Error during signInWithPopup or subsequent processing:', fbError);
       if (fbError.code === 'auth/popup-closed-by-user') {
        const detailedErrorMsg = "Google Sign-In cancelled or popup blocked. Please ensure pop-ups are allowed for this site. Check Firebase/Google Cloud (Authorized Domains, OAuth settings) if issue persists.";
        setError(detailedErrorMsg);
        toast({ title: "Google Sign-In Problem", description: "Pop-up might have been blocked or there's a configuration issue. See message below button for details.", variant: "destructive", duration: 10000 });
      } else if (fbError.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with this email, but using a different sign-in method (e.g., email/password). Please log in with that method.");
        toast({ title: "Account Conflict", description: "Email already in use with a different sign-in method.", variant: "destructive", duration: 7000 });
      } else {
        setError(fbError.message || "Google Sign-In failed. Please try again.");
      }
    } finally {
      console.log('[AuthForm GoogleAuth] Google Sign-In process finished. Setting isLoadingGoogle to false.');
      setIsLoadingGoogle(false);
    }
  };

  const handleSavePostGoogleSignupInfo = async (formData: {
    country: 'India' | 'Other';
    gender: UserProfile['gender'] | '';
    countryCode: string;
    phoneNumber: string;
    referralCode: string; // This is the short code input from the form
  }) => {
    if (!googleAuthData) {
      setError("Google authentication data is missing.");
      return;
    }
    setIsLoadingPostGoogleSignup(true);
    setError(null);

    // Validate new fields
    const postGenderError = validateGender(formData.gender);
    const postCountryCodeError = validateCountryCode(formData.countryCode);
    const postPhoneNumberError = validatePhoneNumber(formData.phoneNumber);

    if (postGenderError || postCountryCodeError || postPhoneNumberError || !formData.country) {
      // For now, just log and toast. A more robust UI would show these errors on the PostGoogleSignupForm.
      console.error("Validation errors in post-Google signup form:", { postGenderError, postCountryCodeError, postPhoneNumberError });
      toast({title: "Validation Error", description: "Please ensure all fields in the additional info form are correct.", variant: "destructive"});
      setIsLoadingPostGoogleSignup(false);
      return;
    }

    try {
      const { uid, email: googleEmail, displayName: googleDisplayName } = googleAuthData;
      let newShortReferralCode = '';
      if (referralProgramEnabled) {
        let attempts = 0;
        let codeExists = true;
        while (codeExists && attempts < 10) {
          newShortReferralCode = generateShortAlphaNumericCode(5);
          codeExists = (await get(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`))).exists();
          attempts++;
        }
        if (codeExists) {
          console.warn("Could not generate unique short referral code for Google user post-signup.");
          newShortReferralCode = '';
        }
      }

      const newUserProfileData: UserProfile = {
        userId: uid,
        displayName: googleDisplayName || "User",
        email: googleEmail || undefined,
        referralCode: uid, // User's own UID for referring others
        totalEarnings: 0,
        createdAt: serverTimestamp() as number,
        country: formData.country,
        currency: formData.country === 'India' ? 'INR' : 'USD',
        gender: formData.gender as UserProfile['gender'],
        countryCode: formData.countryCode.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        canWithdraw: true,
      };

      if (referralProgramEnabled && newShortReferralCode) {
        newUserProfileData.shortReferralCode = newShortReferralCode;
      }
      
      // Process referral code from the post-Google signup form
      // This overrides any device-based referral if a new one is entered here.
      // If a URL referral was passed, `passedReferralCodeProp` was used to prefill this input.
      if (referralProgramEnabled && formData.referralCode.trim()) {
        const postSignupReferralShortCode = formData.referralCode.trim().toUpperCase();
        const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${postSignupReferralShortCode}`));
        if (mapSnap.exists()) {
          const foundReferrerUid = mapSnap.val() as string;
          if (foundReferrerUid === uid) {
            toast({ title: "Invalid Referral", description: "You cannot refer yourself.", variant: "destructive" });
          } else {
            newUserProfileData.referredBy = foundReferrerUid;
            await set(ref(database, `referrals/${foundReferrerUid}/${uid}`), {
              referredUserName: newUserProfileData.displayName,
              timestamp: serverTimestamp()
            });
            localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundReferrerUid); // Persist this referral
            toast({ title: "Referral Applied!", description: "Referral code successfully applied." });
          }
        } else {
          toast({ title: "Referral Code Invalid", description: `The code "${postSignupReferralShortCode}" is not valid.`, variant: "default" });
        }
      } else if (referralProgramEnabled && passedReferralCodeProp && !formData.referralCode.trim()) {
        // If no new code was entered in post-signup form, but one came from URL, re-check it
        const urlReferralShortCode = passedReferralCodeProp.trim().toUpperCase();
        const mapSnap = await get(ref(database, `shortCodeToUserIdMap/${urlReferralShortCode}`));
        if (mapSnap.exists()) {
            const foundReferrerUid = mapSnap.val() as string;
             if (foundReferrerUid !== uid) {
                 newUserProfileData.referredBy = foundReferrerUid;
                 await set(ref(database, `referrals/${foundReferrerUid}/${uid}`), { referredUserName: newUserProfileData.displayName, timestamp: serverTimestamp() });
                 localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundReferrerUid);
                 toast({ title: "Referral Applied!", description: `Referral code ${urlReferralShortCode} from link applied.` });
             }
        }
      }


      await set(ref(database, `users/${uid}`), newUserProfileData);

      if (referralProgramEnabled && newShortReferralCode) {
        await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), uid);
      }

      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', newUserProfileData.displayName);
      localStorage.setItem('drawlyUserUid', uid);
      toast({ title: "Account Created & Logged In!", description: `Welcome, ${newUserProfileData.displayName}!` });
      router.push(redirectAfterAuth || '/');
      setPostGoogleSignupStep('none');
      setGoogleAuthData(null);

    } catch (error: any) {
      console.error("Error saving post-Google signup info:", error);
      setError(error.message || "Failed to save additional details. Please try again.");
      toast({ title: "Error Saving Details", description: "Could not save your additional information.", variant: "destructive" });
    } finally {
      setIsLoadingPostGoogleSignup(false);
    }
  };


  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
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
        toast({ title: "Email Already In Use", description: "This email address is already associated with another account.", variant: "destructive" });
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
    handleFirebaseEmailAuth();
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

  // Determine if submit button should be disabled for email/password form
  const signupFieldsValid = displayName.trim() && country && gender && countryCode.trim() && phoneNumber.trim() && email.trim() && password.trim();
  const signupErrorsClear = !displayNameError && !emailError && !passwordError && !countryCodeError && !phoneNumberError && !validateGender(gender);
  const canSubmitSignup = signupFieldsValid && signupErrorsClear;
  const loginFieldsValid = email.trim() && password.trim();
  const loginErrorsClear = !emailError && !passwordError;
  const canSubmitLogin = loginFieldsValid && loginErrorsClear;
  const isMainFormSubmitDisabled = isLoadingEmail || isLoadingGoogle ||
    (authActionState === 'default' && (isSigningUp ? !canSubmitSignup : !canSubmitLogin));


  let content;
  if (postGoogleSignupStep === 'collectInfo' && googleAuthData) {
    content = (
      <PostGoogleSignupForm
        initialDisplayName={googleAuthData.displayName || "User"}
        passedReferralCodeProp={passedReferralCodeProp} // Pass it down to prefill
        onSubmit={handleSavePostGoogleSignupInfo}
        isLoading={isLoadingPostGoogleSignup}
        referralProgramEnabled={referralProgramEnabled}
        isLoadingPlatformSettings={isLoadingPlatformSettings}
        onCancel={() => {
            setPostGoogleSignupStep('none');
            setGoogleAuthData(null);
            firebaseSignOut(auth); // Log out the partially signed-in Google user
        }}
      />
    );
  } else if (authActionState === 'awaitingVerification') {
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
  } else if (authActionState === 'resetPassword') {
    content = (
      <ResetPasswordContent
        email={email}
        onEmailChange={handleEmailChange}
        onEmailBlur={handleEmailBlur}
        emailError={emailError}
        onSubmit={handleForgotPassword}
        isLoading={isLoadingEmail}
        onBackToLogin={() => handleToggleMode('login')}
        error={error}
      />
    );
  } else { // default state (login or signup)
    content = (
      <form onSubmit={handleFormSubmit} id="auth-form-main" className="space-y-3">
        <AuthError message={error} />
        {isSigningUp && (
          <SignupSpecificFields
            displayName={displayName} onDisplayNameChange={handleDisplayNameChange} onDisplayNameBlur={handleDisplayNameBlur} displayNameError={displayNameError}
            country={country} onCountryChange={setCountry}
            gender={gender} onGenderChange={setGender} // Pass gender state
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
          showPasswordInput={true}
        />
        {!isSigningUp && (
          <button
            type="button"
            className="px-0 text-sm text-primary hover:underline h-auto py-0"
            onClick={() => handleToggleMode('resetPassword')}
            disabled={isLoadingEmail || isLoadingGoogle}
          >
            Forgot Password?
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <AuthCard
        header={
          <AuthHeaderContent
            mode={postGoogleSignupStep === 'collectInfo' ? 'postGoogleSignup' : authActionState === 'awaitingVerification' ? 'awaitingVerification' : authActionState === 'resetPassword' ? 'resetPassword' : isSigningUp ? 'signup' : 'login'}
            unverifiedUserEmail={unverifiedUserEmail}
            displayNameForPostSignup={googleAuthData?.displayName}
          />
        }
        content={content}
        footer={
          (authActionState === 'default' && postGoogleSignupStep === 'none') ? (
            <>
              <AuthSubmitActions
                isSigningUp={isSigningUp}
                onEmailSubmit={handleFormSubmit}
                onGoogleSubmit={handleGoogleAuth}
                isLoadingEmail={isLoadingEmail}
                isLoadingGoogle={isLoadingGoogle}
                isSubmitDisabled={isMainFormSubmitDisabled}
              />
              <AuthModeToggle
                isSigningUp={isSigningUp}
                onToggleMode={() => handleToggleMode(isSigningUp ? 'login' : 'signup')}
                isLoading={isLoadingEmail || isLoadingGoogle}
              />
            </>
          ) : undefined
        }
        showDefaultFooterLinks={authActionState !== 'awaitingVerification' && authActionState !== 'resetPassword' && postGoogleSignupStep === 'none'}
        currentAuthActionState={authActionState}
      />
    </div>
  );
}
