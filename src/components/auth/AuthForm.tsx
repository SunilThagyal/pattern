
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { database } from '@/lib/firebase';
import { ref, set, get, serverTimestamp, onValue, off } from 'firebase/database';
import type { UserProfile, PlatformSettings } from '@/lib/types';

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

interface AuthFormProps {
  passedReferralCodeProp?: string | null; 
  initialActionProp?: string | null; 
  forceSignupFromPath?: boolean; 
  redirectAfterAuth?: string | null;
}

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

  const [isSigningUp, setIsSigningUp] = useState(true);

  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [isLoadingPlatformSettings, setIsLoadingPlatformSettings] = useState(true);

  useEffect(() => {
    const settingsRef = ref(database, 'platformSettings');
    const listener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setReferralProgramEnabled(snapshot.val().referralProgramEnabled !== false);
      } else {
        setReferralProgramEnabled(true);
      }
      setIsLoadingPlatformSettings(false);
    }, (error) => {
      console.error("Error fetching platform settings for AuthForm:", error);
      setReferralProgramEnabled(true); // Fallback on error
      setIsLoadingPlatformSettings(false);
    });

    return () => off(settingsRef, 'value', listener);
  }, []);


  useEffect(() => {
    let codeToSet = '';
    let forceSignupModeForEffect = forceSignupFromPath;

    if (passedReferralCodeProp && passedReferralCodeProp.trim() !== "") {
      codeToSet = passedReferralCodeProp.trim().toUpperCase();
      if (initialActionProp !== 'login') {
        forceSignupModeForEffect = true;
      }
    }
    
    setReferralCodeInput(codeToSet);

    if (forceSignupModeForEffect) {
      setIsSigningUp(true);
    } else if (initialActionProp === 'login') {
      setIsSigningUp(false);
    } else {
      setIsSigningUp(true); 
    }

  }, [passedReferralCodeProp, initialActionProp, forceSignupFromPath]);


  const handleAuth = async (isGoogleAuth: boolean = false) => {
    if (isGoogleAuth) setIsLoadingGoogle(true);
    else setIsLoadingEmail(true);

    let finalEmail = email;
    let finalDisplayName = displayName;
    let finalPassword = password;

    if (isGoogleAuth) {
      const randomNum = Math.floor(Math.random() * 10000);
      finalEmail = `user${randomNum}.google@example.com`;
      finalDisplayName = `GoogleUser${randomNum}`;
      finalPassword = "google_simulated_password";
      if (isSigningUp && !displayName.trim()) {
        setDisplayName(finalDisplayName); 
      }
    }

    if (!finalEmail.trim() || (isSigningUp && !finalDisplayName.trim()) || !finalPassword.trim()) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
      return;
    }

    const simulatedUid = `uid_${finalDisplayName.replace(/\s+/g, '_').toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (isSigningUp) {
        let newShortReferralCode = '';
        if (referralProgramEnabled) { // Only generate if program is enabled
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

            if (codeExists) {
                toast({ title: "Signup Error", description: "Could not generate a unique referral code. Please try again later.", variant: "destructive" });
                if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
                return;
            }
        }

        const newUserProfile: UserProfile = {
          userId: simulatedUid,
          displayName: finalDisplayName,
          email: finalEmail,
          referralCode: simulatedUid, 
          shortReferralCode: referralProgramEnabled ? newShortReferralCode : undefined, 
          totalEarnings: 0,
          createdAt: serverTimestamp() as number,
        };

        if (referralProgramEnabled) { // Only process referrals if program is enabled
            let actualReferrerUid: string | null = null;
            const deviceOriginalReferrerUid = typeof window !== 'undefined' ? localStorage.getItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY) : null;
            const currentReferralShortCodeFromInput = referralCodeInput.trim().toUpperCase(); 

            if (deviceOriginalReferrerUid) {
              actualReferrerUid = deviceOriginalReferrerUid;
              if (currentReferralShortCodeFromInput && currentReferralShortCodeFromInput !== '') {
                const mapRef = ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`);
                const mapSnap = await get(mapRef);
                if (mapSnap.exists() && mapSnap.val() !== deviceOriginalReferrerUid) {
                     toast({
                        title: "Referral Overridden",
                        description: "This device is already linked to a referrer. The original referral has been applied.",
                        variant: "default"
                     });
                }
              }
            } else if (currentReferralShortCodeFromInput && currentReferralShortCodeFromInput !== '') {
              const referrerMapRef = ref(database, `shortCodeToUserIdMap/${currentReferralShortCodeFromInput}`);
              const referrerMapSnap = await get(referrerMapRef);
              if (referrerMapSnap.exists()) {
                const foundReferrerUid = referrerMapSnap.val() as string;
                if (foundReferrerUid === simulatedUid) { 
                   toast({title: "Invalid Referral", description: "You cannot refer yourself.", variant: "default"});
                } else {
                  actualReferrerUid = foundReferrerUid;
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(LSTORAGE_DEVICE_ORIGINAL_REFERRER_UID_KEY, foundReferrerUid);
                  }
                  toast({title: "Referral Applied!", description: `You were successfully referred.`});
                }
              } else {
                toast({ title: "Referral Code Invalid", description: "The referral code was not found. Proceeding without referral.", variant: "default" });
              }
            }

            if (actualReferrerUid) {
              newUserProfile.referredBy = actualReferrerUid;
              const referralsBranchRef = ref(database, `referrals/${actualReferrerUid}/${simulatedUid}`);
              await set(referralsBranchRef, {
                referredUserName: finalDisplayName,
                timestamp: serverTimestamp() as number,
              });
            }
        } // End of referralProgramEnabled block

        await set(ref(database, `users/${simulatedUid}`), newUserProfile);
        if (referralProgramEnabled && newShortReferralCode) {
            await set(ref(database, `shortCodeToUserIdMap/${newShortReferralCode}`), simulatedUid); 
        }

        toast({ title: "Sign Up Successful!", description: `Welcome, ${finalDisplayName}!` });

      } else { 
        let foundUser: UserProfile | null = null;
        let foundUid: string | null = null;

        const allUsersRef = ref(database, 'users');
        const allUsersSnap = await get(allUsersRef);
        if (allUsersSnap.exists()) {
            const usersData = allUsersSnap.val();
            for (const uid_key in usersData) {
                if (usersData[uid_key].email === finalEmail) {
                    foundUser = usersData[uid_key] as UserProfile;
                    foundUid = uid_key;
                    break;
                }
            }
        }

        if (!foundUser || !foundUid) {
          toast({ title: "Login Failed", description: "No account found with this email. Please check your credentials or sign up.", variant: "destructive" });
          if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
          return;
        }
        finalDisplayName = foundUser.displayName; 
        if (typeof window !== 'undefined') {
          localStorage.setItem('drawlyUserUid', foundUid); 
        }
        toast({ title: "Login Successful!", description: `Welcome back, ${finalDisplayName}!` });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('drawlyAuthStatus', 'loggedIn');
        localStorage.setItem('drawlyUserDisplayName', finalDisplayName);
        localStorage.setItem('drawlyUserUid', isSigningUp ? simulatedUid : (localStorage.getItem('drawlyUserUid') || simulatedUid) ); 
      }
      router.push(redirectAfterAuth || '/');

    } catch (error) {
      console.error("Auth error:", error);
      toast({ title: "Authentication Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleAuth(false);
  };

  const disableToggle = isLoadingEmail || isLoadingGoogle || 
                       (forceSignupFromPath && !!(passedReferralCodeProp && passedReferralCodeProp.trim() !== "")) ||
                       (!forceSignupFromPath && !!(passedReferralCodeProp && passedReferralCodeProp.trim() !== ""));


  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{isSigningUp ? "Sign Up" : "Login"} to {APP_NAME}</CardTitle>
          <CardDescription className="text-center">
            {isSigningUp ? "Create an account to play, refer friends, and earn rewards!" : "Welcome back! Log in to continue."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {isSigningUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName_auth_form" className="text-lg">Display Name</Label>
                <Input
                  id="displayName_auth_form"
                  name="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your game name"
                  required={isSigningUp}
                  className="text-base py-6"
                  disabled={isLoadingEmail || isLoadingGoogle}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email_auth_form" className="text-lg">Email</Label>
              <Input
                id="email_auth_form"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="text-base py-6"
                disabled={isLoadingEmail || isLoadingGoogle}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password_auth_form" className="text-lg">Password</Label>
              <Input
                id="password_auth_form"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="text-base py-6"
                disabled={isLoadingEmail || isLoadingGoogle}
              />
            </div>
            {isSigningUp && (
              <div className="space-y-2">
                <Label htmlFor="referral_code" className="text-lg flex items-center">
                   <UserPlus size={18} className="mr-2 text-muted-foreground"/> Referral Code (Optional)
                </Label>
                <Input
                  id="referral_code" 
                  name="referral_code" 
                  type="text"
                  value={referralCodeInput} 
                  onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())} 
                  placeholder="Enter 5-character code"
                  className="text-base py-3"
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
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoadingEmail || isLoadingGoogle}>
              {isLoadingEmail ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSigningUp ? <UserPlus className="mr-2 h-5 w-5" /> : <LogIn className="mr-2 h-5 w-5" />)}
              {isLoadingEmail ? 'Processing...' : (isSigningUp ? 'Sign Up with Email' : 'Login with Email')}
            </Button>

            <div className="relative w-full my-2">
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
              className="w-full text-lg py-6"
              onClick={() => handleAuth(true)}
              disabled={isLoadingGoogle || isLoadingEmail}
              type="button"
            >
              {isLoadingGoogle ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon />}
              {isLoadingGoogle ? 'Processing...' : (isSigningUp ? 'Sign Up with Google' : 'Login with Google')}
            </Button>

            <Button
                variant="link"
                onClick={() => {
                    if (!disableToggle) {
                        setIsSigningUp(!isSigningUp);
                    }
                }}
                className="mt-2"
                disabled={disableToggle}
                type="button"
            >
              {isSigningUp
                ? (disableToggle) 
                    ? "Complete Sign Up with Referral" 
                    : "Already have an account? Login"
                : "Don't have an account? Sign Up"}
            </Button>

            <Link href="/" className="text-sm text-muted-foreground hover:text-primary mt-2">
                Maybe later? Back to Home
            </Link>
          </CardFooter>
        </form>
      </Card>
      <p className="text-xs text-muted-foreground mt-6 max-w-md text-center">
        Note: Account creation and login are simulated for this prototype.
        The 'one device → one original referrer' check is a client-side simulation using localStorage and can be bypassed.
        Real-world applications require robust backend security for referral systems.
      </p>
    </div>
  );
}
