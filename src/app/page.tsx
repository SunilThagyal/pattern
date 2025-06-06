
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Paintbrush, Users, Zap, Loader2, UserPlus, LogIn, LogOut, Gift, DollarSign, Copy } from 'lucide-react';
import Image from 'next/image';
import { APP_NAME } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import type { UserProfile } from '@/lib/types';


export default function HomePage() {
  const [isNavigatingCreate, setIsNavigatingCreate] = useState(false);
  const [isNavigatingJoin, setIsNavigatingJoin] = useState(false);
  const [isNavigatingAuth, setIsNavigatingAuth] = useState(false);
  const [isNavigatingEarnings, setIsNavigatingEarnings] = useState(false);
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [shortReferralCode, setShortReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem('drawlyAuthStatus');
    const storedName = localStorage.getItem('drawlyUserDisplayName');
    const storedUid = localStorage.getItem('drawlyUserUid');

    if (authStatus === 'loggedIn' && storedName && storedUid) {
      setIsAuthenticated(true);
      setUserDisplayName(storedName);
      setUserUid(storedUid);
      // Fetch shortReferralCode
      const userProfileRef = ref(database, `users/${storedUid}`);
      get(userProfileRef).then((snapshot) => {
        if (snapshot.exists()) {
          const profile = snapshot.val() as UserProfile;
          setShortReferralCode(profile.shortReferralCode || null);
        }
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('drawlyAuthStatus');
    localStorage.removeItem('drawlyUserDisplayName');
    localStorage.removeItem('drawlyUserUid');
    setIsAuthenticated(false);
    setUserDisplayName(null);
    setUserUid(null);
    setShortReferralCode(null);
    toast({ title: "Logged Out", description: "You have been logged out."});
  };

  const handleNavigation = (path: string, type: 'create' | 'join' | 'auth' | 'earnings') => {
    if (type === 'create') setIsNavigatingCreate(true);
    if (type === 'join') setIsNavigatingJoin(true);
    if (type === 'auth') setIsNavigatingAuth(true);
    if (type === 'earnings') setIsNavigatingEarnings(true);
    router.push(path);
  };
  
  const handleCopyReferralLink = () => {
    if (shortReferralCode && typeof window !== 'undefined') {
      const referralLink = `${window.location.origin}/referral/${shortReferralCode}`;
      navigator.clipboard.writeText(referralLink)
        .then(() => toast({ title: "Referral Link Copied!", description: "Your Referral Link is copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy Referral Link.", variant: "destructive" }));
    } else if (userUid && typeof window !== 'undefined' && !shortReferralCode) {
        toast({ title: "Referral Code Unavailable", description: "Your short referral code is not yet available. Please try again shortly or re-login.", variant: "default" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center w-full max-w-3xl animate-in fade-in duration-500 py-8 px-4">
      <Image
        src="/placehold.jpg"
        alt={`${APP_NAME} game banner`}
        width={300}
        height={200}
        className="mb-8 rounded-lg shadow-xl"
        data-ai-hint="abstract art party"
      />
      <h1 className="text-5xl font-extrabold tracking-tight mb-4">
        Welcome to <span className="text-primary">{APP_NAME}</span>!
      </h1>
      <p className="text-lg text-muted-foreground mb-6 max-w-xl">
        Unleash your inner artist! Draw, challenge your friends, and guess your way to victory in this exciting real-time multiplayer game.
      </p>

      {!isAuthenticated && (
        <Card className="mb-8 w-full max-w-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-xl"><UserPlus className="mr-2 text-accent" /> Join {APP_NAME} &amp; Refer Friends!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Sign up or log in to get your unique referral code. Share it with friends and earn rewards when they play!
            </p>
            <Button size="lg" className="w-full" onClick={() => router.push('/auth')} disabled={isNavigatingAuth}>
              {isNavigatingAuth ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              {isNavigatingAuth ? 'Loading...' : 'Login / Sign Up'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userDisplayName && (
        <Card className="mb-8 w-full max-w-md bg-green-50 border border-green-200">
          <CardHeader>
            <CardTitle className="text-xl text-green-700">Welcome back, {userDisplayName}!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-green-600 flex items-center justify-center">
                <Gift className="mr-2 h-5 w-5 text-yellow-500"/> Your Referral Code:
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                {shortReferralCode ? (
                  <>
                    <span className="font-mono text-green-700 p-1 bg-green-100 rounded-sm break-all text-base">
                      {shortReferralCode}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleCopyReferralLink} className="h-auto p-1 text-green-600 hover:bg-green-200">
                      <Copy className="mr-1 h-3 w-3"/>Copy Link
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Loading code...</span>
                )}
              </div>
              <p className="text-xs mt-1">Share your referral link (copied with the button) with friends. You'll earn rewards in-game when they complete games!</p>
            </div>
             <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={() => handleNavigation('/earnings', 'earnings')}
              disabled={isNavigatingEarnings}
            >
              {isNavigatingEarnings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
              {isNavigatingEarnings ? 'Loading...' : 'View Earnings Dashboard'}
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 w-full max-w-md">
        <Button
          size="lg"
          className="w-full py-8 text-lg shadow-lg hover:shadow-xl transition-shadow"
          onClick={() => handleNavigation('/create-room', 'create')}
          disabled={isNavigatingCreate}
        >
          {isNavigatingCreate ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : (
            <Paintbrush className="mr-2 h-6 w-6" />
          )}
          {isNavigatingCreate ? 'Loading...' : 'Create New Room'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full py-8 text-lg shadow-lg hover:shadow-xl transition-shadow"
          onClick={() => handleNavigation('/join', 'join')}
          disabled={isNavigatingJoin}
        >
          {isNavigatingJoin ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : (
            <Users className="mr-2 h-6 w-6" />
          )}
          {isNavigatingJoin ? 'Loading...' : 'Join Existing Room'}
        </Button>
      </div>

      <div className="mt-8 w-full">
        <h2 className="text-2xl font-semibold mb-6">How to Play</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Paintbrush className="mr-2 text-primary" />Draw</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>One player gets a word to draw (or use AI sketch!). Get creative!</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Zap className="mr-2 text-accent" />Guess</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Other players race to guess the drawing. Type your guesses quickly!</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Users className="mr-2 text-primary" />Score</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Earn points for correct guesses and for your drawing skills!</CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

