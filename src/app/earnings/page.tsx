
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReferralManagementTab from '@/components/earnings/ReferralManagementTab';
import WithdrawalManagementTab from '@/components/earnings/WithdrawalManagementTab';
import TransactionHistoryTab from '@/components/earnings/TransactionHistoryTab';
import { DollarSign, Users, CreditCard, History, Loader2, Home } from 'lucide-react';
import { APP_NAME } from '@/lib/config';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import type { UserProfile } from '@/lib/types';

export default function EarningsDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authUserUid, setAuthUserUid] = useState<string | null>(null);

  useEffect(() => {
    const storedAuthStatus = localStorage.getItem('drawlyAuthStatus');
    const storedUid = localStorage.getItem('drawlyUserUid');

    if (storedAuthStatus === 'loggedIn' && storedUid) {
      setAuthUserUid(storedUid);
      const userProfileRef = ref(database, `users/${storedUid}`);
      get(userProfileRef).then((snapshot) => {
        if (snapshot.exists()) {
          setUserProfile(snapshot.val() as UserProfile);
        } else {
          // User profile doesn't exist in DB, possible issue or new user not yet written
          console.warn("User profile not found in DB for UID:", storedUid);
          setUserProfile(null); // Or handle as an error state
        }
        setIsLoading(false);
      }).catch(error => {
        console.error("Error fetching user profile:", error);
        setIsLoading(false);
        setUserProfile(null);
      });
    } else {
      setIsLoading(false);
      setUserProfile(null); // Not authenticated
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading Earnings Dashboard...</p>
      </div>
    );
  }

  if (!userProfile || !authUserUid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need to be logged in to view your earnings dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/auth')}>Login / Sign Up</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center">
                <DollarSign className="mr-3 h-8 w-8 text-primary" />
                {APP_NAME} Earnings Dashboard
                </h1>
                <p className="text-muted-foreground mt-1">
                Welcome, {userProfile.displayName || 'Player'}! Track your referrals, manage earnings, and view transactions.
                </p>
            </div>
            <Button variant="outline" onClick={() => router.push('/')} className="self-start sm:self-center">
                <Home className="mr-2 h-4 w-4" />
                Back to Game Lobby
            </Button>
        </div>
      </header>

      <Tabs defaultValue="referrals" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 mb-6">
          <TabsTrigger value="referrals" className="py-2 sm:py-3 text-sm sm:text-base">
            <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Referral Management
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="py-2 sm:py-3 text-sm sm:text-base">
            <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Withdrawal Management
          </TabsTrigger>
          <TabsTrigger value="history" className="py-2 sm:py-3 text-sm sm:text-base">
            <History className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <ReferralManagementTab authUserUid={authUserUid} userProfile={userProfile} />
        </TabsContent>
        <TabsContent value="withdrawals">
          <WithdrawalManagementTab authUserUid={authUserUid} initialBalance={userProfile.totalEarnings} />
        </TabsContent>
        <TabsContent value="history">
          <TransactionHistoryTab authUserUid={authUserUid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
