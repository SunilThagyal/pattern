
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { database } from '@/lib/firebase';
import { ref, set, get, serverTimestamp } from 'firebase/database';
import type { UserProfile } from '@/lib/types';

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(true); // Default to sign up

  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlReferralCode = searchParams.get('referralCode');
    const action = searchParams.get('action');

    if (urlReferralCode) {
      setReferralCodeInput(urlReferralCode);
      setIsSigningUp(true); // Force sign-up mode if referral code is present
    } else if (action === 'login') {
      setIsSigningUp(false);
    } else {
      setIsSigningUp(true); // Default to signup
    }
  }, [searchParams]);

  const handleAuth = async (isGoogleAuth: boolean = false) => {
    if (isGoogleAuth) setIsLoadingGoogle(true);
    else setIsLoadingEmail(true);

    let finalEmail = email;
    let finalDisplayName = displayName;
    let finalPassword = password; 

    if (isGoogleAuth) {
      // Simulate Google providing details
      finalEmail = `user${Math.floor(Math.random() * 10000)}@gmail.com`; 
      finalDisplayName = (finalEmail.split('@')[0] || "GoogleUser") + Math.floor(Math.random() * 100);
      finalPassword = "google_simulated_password"; // Dummy for validation if needed
       // For Google Auth, if displayName is not set yet (e.g. user didn't type anything for email signup first)
      if (isSigningUp && !displayName.trim()) {
        setDisplayName(finalDisplayName); // Pre-fill display name for Google sign-up
      }
    }


    if (!finalEmail.trim() || (isSigningUp && !finalDisplayName.trim()) || !finalPassword.trim()) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
      return;
    }

    const simulatedUid = `uid_${finalDisplayName.replace(/\s+/g, '_').toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const userRef = ref(database, `users/${simulatedUid}`);
      const userSnapshot = await get(userRef);

      if (isSigningUp) {
        if (userSnapshot.exists()) {
          toast({ title: "User Exists", description: "This email is already registered. Try logging in.", variant: "destructive" });
          if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
          return;
        }

        const newUserProfile: UserProfile = {
          userId: simulatedUid,
          displayName: finalDisplayName,
          email: finalEmail,
          referralCode: simulatedUid, 
          totalEarnings: 0,
          createdAt: serverTimestamp() as number,
        };

        if (referralCodeInput.trim()) {
          // Ensure not referring self
          if (referralCodeInput.trim() === simulatedUid) {
             toast({title: "Invalid Referral", description: "You cannot refer yourself.", variant: "default"});
          } else {
            const referrerRef = ref(database, `users/${referralCodeInput.trim()}`);
            const referrerSnapshot = await get(referrerRef);
            if (referrerSnapshot.exists()) {
              newUserProfile.referredBy = referralCodeInput.trim();
              const referrerDisplayName = referrerSnapshot.val().displayName || "Referrer";
              
              const referralsBranchRef = ref(database, `referrals/${referralCodeInput.trim()}/${simulatedUid}`);
              await set(referralsBranchRef, {
                referredUserName: finalDisplayName,
                timestamp: serverTimestamp() as number,
              });
              toast({title: "Referral Applied!", description: `You were successfully referred by ${referrerDisplayName}.`});
            } else {
              toast({ title: "Referral Code Invalid", description: "The referral code entered was not found. Proceeding without referral.", variant: "default" });
            }
          }
        }
        await set(userRef, newUserProfile);
        toast({ title: "Sign Up Successful!", description: `Welcome, ${finalDisplayName}!` });
      } else { // Logging in
        // Simplified login: find user by email (conceptually, real auth is more complex)
        // This part is still very simulated as we don't have password checking or unique email enforcement in DB for login
        let foundUser = null;
        if (userSnapshot.exists() && userSnapshot.val().email === finalEmail) { // Basic check if UID from derived name + random matches this email
            foundUser = userSnapshot.val();
        } else {
            // Try to find user by email (this is a very inefficient scan for RTDB, real auth is better)
            const allUsersRef = ref(database, 'users');
            const allUsersSnap = await get(allUsersRef);
            if (allUsersSnap.exists()) {
                const usersData = allUsersSnap.val();
                for (const uid in usersData) {
                    if (usersData[uid].email === finalEmail) {
                        foundUser = usersData[uid];
                        // Correct the simulatedUid to the actual UID found
                        localStorage.setItem('drawlyUserUid', uid); // Update UID in localStorage
                        break;
                    }
                }
            }
        }

        if (!foundUser) {
          toast({ title: "Login Failed", description: "No account found with this email. Try signing up.", variant: "destructive" });
          if (isGoogleAuth) setIsLoadingGoogle(false); else setIsLoadingEmail(false);
          return;
        }
        finalDisplayName = foundUser.displayName; // Use stored display name on login
        toast({ title: "Login Successful!", description: `Welcome back, ${finalDisplayName}!` });
      }

      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', finalDisplayName);
      localStorage.setItem('drawlyUserUid', isSigningUp ? simulatedUid : localStorage.getItem('drawlyUserUid') || simulatedUid); // Use existing UID on login if found
      
      router.push('/');
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
                <Label htmlFor="displayName" className="text-lg">Display Name</Label>
                <Input
                  id="displayName"
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
              <Label htmlFor="email" className="text-lg">Email</Label>
              <Input
                id="email"
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
              <Label htmlFor="password" className="text-lg">Password</Label>
              <Input
                id="password"
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
                <Label htmlFor="referralCode" className="text-lg flex items-center">
                   <UserPlus size={18} className="mr-2 text-muted-foreground"/> Referral Code (Optional)
                </Label>
                <Input
                  id="referralCode"
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  placeholder="Enter referrer's User ID"
                  className="text-base py-3"
                  maxLength={30} 
                  disabled={isLoadingEmail || isLoadingGoogle}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoadingEmail || isLoadingGoogle}>
              {isLoadingEmail ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
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

            <Button variant="link" onClick={() => setIsSigningUp(!isSigningUp)} className="mt-2" disabled={isLoadingEmail || isLoadingGoogle}>
              {isSigningUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </Button>

            <Link href="/" className="text-sm text-muted-foreground hover:text-primary mt-2">
                Maybe later? Back to Home
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

