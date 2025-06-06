
"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, Mail } from 'lucide-react'; // Using Mail for Google icon placeholder
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

// Placeholder for Google Icon, you can replace with an actual SVG or library icon
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
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailAuth = (e: FormEvent) => {
    e.preventDefault();
    setIsLoadingEmail(true);

    if (!email.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please enter both email and password.", variant: "destructive" });
      setIsLoadingEmail(false);
      return;
    }

    setTimeout(() => {
      const nameParts = email.split('@');
      const dummyNameFromEmail = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "User" + Math.floor(Math.random() * 1000);
      const dummyUid = `uid_email_${Math.random().toString(36).substr(2, 9)}`;

      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', dummyNameFromEmail);
      localStorage.setItem('drawlyUserUid', dummyUid);
      
      toast({ title: "Success!", description: `Welcome, ${dummyNameFromEmail}! You are now logged in.`});
      router.push('/'); 
      setIsLoadingEmail(false);
    }, 1000); 
  };

  const handleGoogleAuth = () => {
    setIsLoadingGoogle(true);
    // Simulate Google Sign-In
    setTimeout(() => {
      // In a real scenario, Google provides user info. We'll simulate it.
      const simulatedGoogleEmail = `user${Math.floor(Math.random() * 10000)}@gmail.com`;
      const nameParts = simulatedGoogleEmail.split('@');
      const dummyNameFromGoogle = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "GoogleUser";
      const dummyUidGoogle = `uid_google_${Math.random().toString(36).substr(2, 9)}`;

      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', dummyNameFromGoogle);
      localStorage.setItem('drawlyUserUid', dummyUidGoogle);

      toast({ title: "Google Sign-In Success!", description: `Welcome, ${dummyNameFromGoogle}! You are now logged in.` });
      router.push('/');
      setIsLoadingGoogle(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Login or Sign Up</CardTitle>
          <CardDescription className="text-center">
            Join {APP_NAME} to save your progress and use referral features.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleEmailAuth}>
          <CardContent className="space-y-6">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoadingEmail || isLoadingGoogle}>
              {isLoadingEmail ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Login / Sign Up with Email
                </>
              )}
            </Button>
            
            <div className="relative w-full my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full text-lg py-6" 
              onClick={handleGoogleAuth} 
              disabled={isLoadingGoogle || isLoadingEmail}
              type="button"
            >
              {isLoadingGoogle ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Sign in with Google
                </>
              )}
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
