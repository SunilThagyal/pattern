
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus, AlertCircle, Globe, Phone, UserCircle2, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { database, auth } from '@/lib/firebase'; // Import auth
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail, signOut as firebaseSignOut, updateEmail as firebaseUpdateEmail, type User } from "firebase/auth"; // Firebase auth functions
import type { UserProfile, PlatformSettings } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ref, set, get, serverTimestamp, onValue, off, update } from 'firebase/database';


const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const generateShortAlphaNumericCode = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
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
    return false; // Default to Login
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

  const [isSigningUp, setIsSigningUp] = useState(() =>
    determineInitialIsSigningUp(forceSignupFromPath, initialActionProp, passedReferralCodeProp)
  );

  const [error, setError] = useState<string | null>(null); // General form error

  // Field-specific errors
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
      console.error("Error fetching platform settings for AuthForm:", err);
      setReferralProgramEnabled(true);
      setIsLoadingPlatformSettings(false);
    });

    return () => off(settingsRef, 'value', listener);
  }, []);


  useEffect(() => {
    const newDeterminedSigningUpState = determineInitialIsSigningUp(forceSignupFromPath, initialActionProp, passedReferralCodeProp);
    if (newDeterminedSigningUpState !== isSigningUp) {
        setIsSigningUp(newDeterminedSigningUpState);
    }

    let codeToSet = '';
    if (passedReferralCodeProp && passedReferralCodeProp.trim() !== "") {
      codeToSet = passedReferralCodeProp.trim().toUpperCase();
    }
    setReferralCodeInput(codeToSet);

    if (authActionState !== 'awaitingVerification') {
        setAuthActionState('default');
    }
    setError(null);
    setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');

  }, [passedReferralCodeProp, initialActionProp, forceSignupFromPath, isSigningUp, authActionState]);


  const handleFirebaseEmailAuth = async () => {
    setError(null);
    setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');
    setIsLoadingEmail(true);

    const currentEmailError = validateEmail(email);
    const currentPasswordError = validatePassword(password);

    if (isSigningUp) {
      const currentDisplayNameError = validateDisplayName(displayName);
      const currentCountryCodeError = validateCountryCode(countryCode);
      const currentPhoneNumberError = validatePhoneNumber(phoneNumber);

      setDisplayNameError(currentDisplayNameError);
      setEmailError(currentEmailError);
      setPasswordError(currentPasswordError);
      setCountryCodeError(currentCountryCodeError);
      setPhoneNumberError(currentPhoneNumberError);


      if (currentDisplayNameError || currentEmailError || currentPasswordError || currentCountryCodeError || currentPhoneNumberError || !country || !gender) {
         setError("Please fill all required fields and correct any errors.");
         setIsLoadingEmail(false);
         return;
      }
    } else { // Login
       setEmailError(currentEmailError);
       setPasswordError(currentPasswordError);
       if (currentEmailError || currentPasswordError) {
          setError("Please correct the errors above.");
          setIsLoadingEmail(false);
          return;
       }
    }


    if (isSigningUp) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user) {
          await sendEmailVerification(user);

          let newShortReferralCode = '';
          if (referralProgramEnabled) {
              let codeExists = true;
              let attempts = 0;
              const MAX_CODE_GEN_ATTEMPTS = 10;
              while(codeExists && attempts < MAX_CODE_GEN_ATTEMPTS) {
                  newShortReferralCode = generateShortAlphaNumericCode(5);
                  const shortCodeMapRef = ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`);
                  const shortCodeSnap = await get(shortCodeMapRef);
                  codeExists = shortCodeSnap.exists();
                  attempts++;
              }
              if (codeExists) console.warn("Could not generate unique referral code after attempts.");
          }

          const newUserProfile: UserProfile = {
            userId: user.uid,
            displayName: displayName.trim(),
            email: user.email || email,
            referralCode: user.uid,
            shortReferralCode: referralProgramEnabled && newShortReferralCode ? newShortReferralCode : undefined,
            totalEarnings: 0,
            createdAt: serverTimestamp() as number,
            country: country,
            currency: country === 'India' ? 'INR' : 'USD',
            gender: gender as UserProfile['gender'],
            countryCode: countryCode.trim(),
            phoneNumber: phoneNumber.trim(),
            canWithdraw: true,
          };

          if (referralProgramEnabled) {
            let actualReferrerUid: string | null = null;
            const deviceOriginalReferrerUid = typeof window !== 'undefined' ? localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY) : null;
            const currentReferralShortCodeFromInput = referralCodeInput.trim().toUpperCase();

            if (deviceOriginalReferrerUid) {
              actualReferrerUid = deviceOriginalReferrerUid;
               if (currentReferralShortCodeFromInput && currentReferralShortCodeFromInput !== '') {
                    const mapRef = ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`);
                    const mapSnap = await get(mapRef);
                    if (mapSnap.exists() && mapSnap.val() !== deviceOriginalReferrerUid) {
                         toast({ title: "Referral Overridden", description: "This device is already linked to a referrer. The original referral has been applied.", variant: "default" });
                    }
                }
            } else if (currentReferralShortCodeFromInput && currentReferralShortCodeFromInput !== '') {
              const referrerMapRef = ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`);
              const referrerMapSnap = await get(referrerMapRef);
              if (referrerMapSnap.exists()) {
                const foundReferrerUid = referrerMapSnap.val() as string;
                if (foundReferrerUid === user.uid) {
                   toast({title: "Invalid Referral", description: "You cannot refer yourself.", variant: "default"});
                } else {
                  actualReferrerUid = foundReferrerUid;
                  if (typeof window !== 'undefined') localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundReferrerUid);
                  toast({title: "Referral Applied!", description: `You were successfully referred.`});
                }
              } else {
                toast({ title: "Referral Code Invalid", description: "The referral code was not found. Proceeding without referral.", variant: "default" });
              }
            }
             if (actualReferrerUid) {
              newUserProfile.referredBy = actualReferrerUid;
              await set(ref(database, `referrals/${actualReferrerUid}/${user.uid}`), {
                referredUserName: displayName.trim(),
                timestamp: serverTimestamp() as number,
              });
            }
          }

          await set(ref(database, `users/${user.uid}`), newUserProfile);
          if (referralProgramEnabled && newShortReferralCode) {
            await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), user.uid);
          }

          setUnverifiedUserEmail(user.email);
          setAuthActionState('awaitingVerification');
           toast({ title: "Sign Up Almost Complete!", description: `Welcome, ${displayName}! A verification email has been sent to ${email}. Please verify your email.` });
        }
      } catch (fbError: any) {
        console.error("Firebase Signup Error:", fbError);
        if (fbError.code === 'auth/email-already-in-use') {
            setError("This email is already in use. Please login or use a different email.");
        } else if (fbError.code === 'auth/weak-password') {
            setPasswordError("Password should be at least 6 characters.");
        } else {
            setError(fbError.message || "Signup failed. Please try again.");
        }
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

          const userProfileRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userProfileRef);
          let userDisplayNameFromDB = "Player";
          if (snapshot.exists()) {
            userDisplayNameFromDB = snapshot.val().displayName || "Player";
          }

          if (typeof window !== 'undefined') {
            localStorage.setItem('drawlyAuthStatus', 'loggedIn');
            localStorage.setItem('drawlyUserDisplayName', userDisplayNameFromDB);
            localStorage.setItem('drawlyUserUid', user.uid);
          }
          toast({ title: "Login Successful!", description: `Welcome back, ${userDisplayNameFromDB}!` });
          router.push(redirectAfterAuth || '/');
        }
      } catch (fbError: any) {
        console.error("Firebase Login Error:", fbError);
        if (fbError.code === 'auth/user-not-found' || fbError.code === 'auth/wrong-password' || fbError.code === 'auth/invalid-credential') {
            setError("Invalid email or password. Please try again or sign up.");
        } else {
            setError(fbError.message || "Login failed. Please try again.");
        }
      }
    }
    setIsLoadingEmail(false);
  };

  const handleForgotPassword = async () => {
    setError(null);
    const currentEmailError = validateEmail(email);
    setEmailError(currentEmailError);
    if (currentEmailError) {
      setError("Please enter a valid email address to reset password.");
      return;
    }
    setIsLoadingEmail(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({
        title: "Password Reset Email Sent",
        description: `If an account for ${email.trim()} exists, a password reset link has been sent. Please check your inbox and spam/junk folder.`,
        duration: 7000
      });
      setAuthActionState('default');
    } catch (fbError: any) {
      console.error("Forgot Password Error:", fbError);
       if (fbError.code === 'auth/invalid-email') {
            setEmailError("The email address format is not valid.");
            setError("Please check the email address format.");
      } else if (fbError.code === 'auth/missing-email') {
            setEmailError("Please enter your email address.");
            setError("Please enter your email address.");
      } else {
            setError("Could not send password reset email at this time. Please try again later.");
      }
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!auth.currentUser) {
      toast({ title: "Error", description: "No user session found. Please log in again.", variant: "destructive" });
      setAuthActionState('default');
      return;
    }
    setIsResendingVerification(true);
    const lastSent = Number(localStorage.getItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT));
    if (Date.now() - lastSent < EMAIL_RESEND_COOLDOWN_MS) {
      toast({ title: "Please Wait", description: `You can resend the verification email again in about ${Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 60000)} minute(s).`, variant: "default" });
      setIsResendingVerification(false);
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      localStorage.setItem(LSTORAGE_LAST_VERIFICATION_EMAIL_SENT_AT, Date.now().toString());
      toast({ title: "Verification Email Resent", description: `A new verification email has been sent to ${auth.currentUser.email}. Please check your inbox (and spam folder).` });
    } catch (error: any) {
      console.error("Error resending verification email:", error);
      toast({ title: "Error", description: error.message || "Could not resend verification email.", variant: "destructive" });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!auth.currentUser) {
      toast({ title: "Error", description: "No user session found. Please log in again.", variant: "destructive" });
      setAuthActionState('default');
      return;
    }
    const newEmailValidationError = validateEmail(newEmailForVerification.trim());
    if (newEmailValidationError) {
        toast({ title: "Invalid Email", description: newEmailValidationError, variant: "destructive" });
        return;
    }
    setIsUpdatingEmail(true);
    try {
        const currentFbUser = auth.currentUser;
        await firebaseUpdateEmail(currentFbUser, newEmailForVerification.trim());

        await update(ref(database, `users/${currentFbUser.uid}`), { email: newEmailForVerification.trim() });

        await sendEmailVerification(currentFbUser);

        setUnverifiedUserEmail(newEmailForVerification.trim());
        setNewEmailForVerification('');
        toast({ title: "Email Updated", description: `Your email has been updated to ${newEmailForVerification.trim()}. A new verification email has been sent. Please check your inbox.` });
    } catch (error: any)
      {
        console.error("Error updating email:", error);
        if (error.code === 'auth/requires-recent-login') {
            toast({ title: "Action Requires Re-authentication", description: "For security, please log out and log back in before changing your email.", variant: "destructive", duration: 7000 });
        } else if (error.code === 'auth/email-already-in-use') {
            toast({ title: "Email In Use", description: "This email address is already associated with another account.", variant: "destructive"});
        } else {
            toast({ title: "Error", description: error.message || "Could not update email.", variant: "destructive" });
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
    setEmail('');
    setPassword('');
    setError(null);
    setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');
    toast({ title: "Logged Out" });
  };


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (authActionState === 'resetPassword') {
      handleForgotPassword();
    } else if (authActionState === 'default') {
      handleFirebaseEmailAuth();
    }
  };

  const handleGoogleAuthSimulated = () => {
    setIsLoadingGoogle(true);
    const randomNum = Math.floor(Math.random() * 10000);
    const simulatedEmail = `user${randomNum}.google@example.com`;
    const simulatedDisplayName = `GoogleUser${randomNum}`;
    const simulatedUid = `uid_google_${randomNum}`;

    toast({ title: "Google Sign-In (Simulated)", description: `Simulating login for ${simulatedDisplayName}. This is not real Google Sign-In.` });

    if (typeof window !== 'undefined') {
      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', simulatedDisplayName);
      localStorage.setItem('drawlyUserUid', simulatedUid);
    }

    const userProfileRef = ref(database, `users/${simulatedUid}`);
    get(userProfileRef).then((snapshot) => {
        if(!snapshot.exists()){
            const newUserProfile: UserProfile = {
                userId: simulatedUid,
                displayName: simulatedDisplayName,
                email: simulatedEmail,
                referralCode: simulatedUid,
                totalEarnings: 0,
                createdAt: serverTimestamp() as number,
                country: 'India',
                currency: 'INR',
                gender: 'prefer_not_to_say',
                countryCode: '+91',
                phoneNumber: '0000000000',
                canWithdraw: true,
            };
            set(userProfileRef, newUserProfile);
        }
    });

    setTimeout(() => {
        setIsLoadingGoogle(false);
        router.push(redirectAfterAuth || '/');
    }, 1500);
  };

  const disableToggle = isLoadingEmail || isLoadingGoogle ||
                       (forceSignupFromPath && !!(passedReferralCodeProp && passedReferralCodeProp.trim() !== "")) ||
                       (!forceSignupFromPath && !!(passedReferralCodeProp && passedReferralCodeProp.trim() !== ""));

  const signupFieldsValid = displayName.trim() && country && gender && countryCode.trim() && phoneNumber.trim() && email.trim() && password.trim();
  const signupErrorsClear = !displayNameError && !emailError && !passwordError && !countryCodeError && !phoneNumberError;
  const canSubmitSignup = signupFieldsValid && signupErrorsClear;

  const loginFieldsValid = email.trim() && password.trim();
  const loginErrorsClear = !emailError && !passwordError;
  const canSubmitLogin = loginFieldsValid && loginErrorsClear;

  const isSubmitDisabled = isLoadingEmail || isLoadingGoogle || (authActionState === 'default' && (isSigningUp ? !canSubmitSignup : !canSubmitLogin));


  if (authActionState === 'awaitingVerification') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
            <CardDescription className="text-center">
              Your email address <strong className="text-primary">{unverifiedUserEmail}</strong> is not verified.
              A verification email has been sent. Please check your inbox (and spam folder).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive">
                    <AlertCircle className="inline-block mr-1 h-4 w-4" /> {error}
                </div>
            )}
            <Button onClick={handleResendVerificationEmail} className="w-full" disabled={isResendingVerification || isUpdatingEmail}>
              {isResendingVerification ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
              {isResendingVerification ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="newEmailForVerification" className="text-md">Incorrect email? Update it here:</Label>
                <Input
                    id="newEmailForVerification"
                    type="email"
                    placeholder="Enter new email address"
                    value={newEmailForVerification}
                    onChange={(e) => setNewEmailForVerification(e.target.value)}
                    disabled={isResendingVerification || isUpdatingEmail}
                />
                <Button onClick={handleUpdateEmail} variant="outline" className="w-full" disabled={isResendingVerification || isUpdatingEmail || !newEmailForVerification.trim()}>
                    {isUpdatingEmail ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                    {isUpdatingEmail ? 'Updating...' : 'Update Email & Resend Verification'}
                </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button variant="link" onClick={handleUserLogoutForVerificationScreen} disabled={isResendingVerification || isUpdatingEmail}>
              Logout
            </Button>
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                Back to Home
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">
            {authActionState === 'resetPassword' ? "Reset Password" : (isSigningUp ? "Sign Up" : "Login")} to {APP_NAME}
          </CardTitle>
          <CardDescription className="text-center">
            {authActionState === 'resetPassword'
              ? "Enter your email to receive a password reset link."
              : isSigningUp
                ? "Create an account to play, refer friends, and earn rewards! A verification email will be sent to complete your registration."
                : "Welcome back! Log in to continue."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center text-sm text-destructive">
                    <AlertCircle className="inline-block mr-1 h-4 w-4" /> {error}
                </div>
            )}
            {authActionState === 'default' && isSigningUp && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="displayName_auth_form">Display Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="displayName_auth_form"
                    name="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); if (displayNameError) setDisplayNameError(''); }}
                    onBlur={handleDisplayNameBlur}
                    placeholder="Your game name"
                    required={isSigningUp}
                    className="text-base"
                    disabled={isLoadingEmail || isLoadingGoogle}
                  />
                  {displayNameError && <p className="text-xs text-destructive mt-1">{displayNameError}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country_auth_form" className="flex items-center">
                    <Globe size={16} className="mr-1 text-muted-foreground"/> Country <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={country}
                    onValueChange={(value: 'India' | 'Other') => setCountry(value)}
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  >
                    <SelectTrigger id="country_auth_form" className="text-base">
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="India">India (INR ₹)</SelectItem>
                      <SelectItem value="Other">Other (USD $)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gender_auth_form" className="flex items-center">
                    <UserCircle2 size={16} className="mr-1 text-muted-foreground"/> Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={gender}
                    onValueChange={(value: UserProfile['gender'] | '') => setGender(value)}
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  >
                    <SelectTrigger id="gender_auth_form" className="text-base">
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
                        <Label htmlFor="country_code_auth_form" className="flex items-center">Code <span className="text-destructive ml-1">*</span></Label>
                        <Input
                            id="country_code_auth_form"
                            name="countryCode"
                            type="text"
                            value={countryCode}
                            onChange={(e) => { setCountryCode(e.target.value); if (countryCodeError) setCountryCodeError(''); }}
                            onBlur={handleCountryCodeBlur}
                            placeholder="+91"
                            required={isSigningUp}
                            className="text-base"
                            disabled={isLoadingEmail || isLoadingGoogle}
                        />
                        {countryCodeError && <p className="text-xs text-destructive mt-1">{countryCodeError}</p>}
                    </div>
                    <div className="col-span-2 space-y-1">
                        <Label htmlFor="phone_number_auth_form" className="flex items-center">
                           Phone <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                            id="phone_number_auth_form"
                            name="phoneNumber"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => { setPhoneNumber(e.target.value); if (phoneNumberError) setPhoneNumberError(''); }}
                            onBlur={handlePhoneNumberBlur}
                            placeholder="Your phone number"
                            required={isSigningUp}
                            className="text-base"
                            disabled={isLoadingEmail || isLoadingGoogle}
                        />
                        {phoneNumberError && <p className="text-xs text-destructive mt-1">{phoneNumberError}</p>}
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground">Your phone number is used for account purposes only.</p>
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="email_auth_form">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email_auth_form"
                name="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                onBlur={handleEmailBlur}
                placeholder="you@example.com"
                required
                className="text-base"
                disabled={isLoadingEmail || isLoadingGoogle}
              />
              {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
            </div>
            {authActionState !== 'resetPassword' && (
                 <div className="space-y-1">
                    <Label htmlFor="password_auth_form">Password <span className="text-destructive">*</span></Label>
                    <Input
                        id="password_auth_form"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }}
                        onBlur={handlePasswordBlur}
                        placeholder="••••••••"
                        required
                        className="text-base"
                        disabled={isLoadingEmail || isLoadingGoogle}
                    />
                    {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
                </div>
            )}

            {authActionState === 'default' && !isSigningUp && (
                <Button
                    type="button"
                    variant="link"
                    className="px-0 text-sm text-primary hover:underline h-auto py-0"
                    onClick={() => {setAuthActionState('resetPassword'); setError(null); setEmailError(''); setPasswordError('');}}
                    disabled={isLoadingEmail || isLoadingGoogle}
                >
                    Forgot Password?
                </Button>
            )}
            {authActionState === 'default' && isSigningUp && (
              <div className="space-y-1">
                <Label htmlFor="referral_code" className="flex items-center">
                   <UserPlus size={16} className="mr-1 text-muted-foreground"/> Referral Code (Optional)
                </Label>
                <Input
                  id="referral_code"
                  name="referral_code"
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter 5-character code"
                  className="text-base"
                  maxLength={5}
                  disabled={isLoadingEmail || isLoadingGoogle || isLoadingPlatformSettings || !referralProgramEnabled}
                />
                {isLoadingPlatformSettings && <p className="text-xs text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin inline-block"/>Loading referral status...</p>}
                {!isLoadingPlatformSettings && !referralProgramEnabled && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1">
                        <AlertCircle size={14}/> The referral program is currently disabled.
                    </p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full text-base py-5" disabled={isSubmitDisabled}>
              {isLoadingEmail ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> :
                (authActionState === 'resetPassword' ? <Mail className="mr-2 h-5 w-5" /> : (isSigningUp ? <UserPlus className="mr-2 h-5 w-5" /> : <LogIn className="mr-2 h-5 w-5" />))
              }
              {isLoadingEmail ? 'Processing...' :
                (authActionState === 'resetPassword' ? "Send Reset Email" : (isSigningUp ? 'Sign Up with Email' : 'Login with Email'))
              }
            </Button>

            {authActionState !== 'resetPassword' && (
                <>
                <div className="relative w-full my-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full text-base py-5"
                  onClick={handleGoogleAuthSimulated}
                  disabled={isLoadingGoogle || isLoadingEmail}
                  type="button"
                >
                  {isLoadingGoogle ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon />}
                  {isLoadingGoogle ? 'Processing...' : (isSigningUp ? 'Sign Up with Google (Simulated)' : 'Login with Google (Simulated)')}
                </Button>
                </>
            )}

            <Button
                variant="link"
                onClick={() => {
                    if (authActionState === 'resetPassword') {
                        setAuthActionState('default');
                        setIsSigningUp(false);
                    } else if (!disableToggle) {
                        setIsSigningUp(!isSigningUp);
                    }
                    setError(null);
                    setDisplayNameError(''); setEmailError(''); setPasswordError(''); setCountryCodeError(''); setPhoneNumberError('');
                }}
                className="mt-1"
                disabled={disableToggle && authActionState !== 'resetPassword'}
                type="button"
            >
              {authActionState === 'resetPassword'
                ? <><ArrowLeft className="mr-1 h-4 w-4"/> Back to Login</>
                : isSigningUp
                    ? (disableToggle ? "Complete Sign Up with Referral" : "Already have an account? Login")
                    : "Don't have an account? Sign Up"}
            </Button>

            <Link href="/" className="text-sm text-muted-foreground hover:text-primary mt-1">
                Maybe later? Back to Home
            </Link>
          </CardFooter>
        </form>
      </Card>
      <p className="text-xs text-muted-foreground mt-4 max-w-md text-center">
        Email/password authentication uses Firebase. Google Sign-In is simulated.
      </p>
    </div>
  );
}

